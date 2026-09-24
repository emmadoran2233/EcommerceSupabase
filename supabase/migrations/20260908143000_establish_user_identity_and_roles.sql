-- Establish one canonical application identity and explicit marketplace roles.
--
-- Compatibility rules for this migration:
--   * auth.users.id remains the identity source of truth.
--   * public.users remains available while application code is migrated.
--   * orders.user_id remains available while readers move to orders.buyer_id.
--   * a user may be both a buyer and a seller.

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('buyer', 'seller', 'platform_admin')),
  source text not null default 'self_service'
    check (source in ('auth_trigger', 'inventory_backfill', 'self_service', 'manual_admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Active marketplace capabilities attached to an auth.users identity. Every registered user receives an active buyer role, and a user may hold multiple roles.';
comment on column public.user_roles.source is
  'Records how the role was established without using editable user metadata for authorization.';

create index if not exists idx_user_roles_role_user_id
  on public.user_roles (role, user_id);

create table if not exists public.seller_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  activation_source text not null default 'self_service'
    check (activation_source in ('inventory_backfill', 'self_service', 'platform_admin')),
  activated_at timestamptz not null default now(),
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_accounts_suspension_check check (
    status <> 'suspended' or suspended_at is not null
  )
);

comment on table public.seller_accounts is
  'Seller onboarding and enforcement state. A seller role alone does not imply an active seller account.';

create index if not exists idx_seller_accounts_status_user_id
  on public.seller_accounts (status, user_id);

create index if not exists idx_products_seller_id
  on public.products (seller_id)
  where seller_id is not null;

create index if not exists idx_lend_items_seller_id
  on public.lend_items (seller_id)
  where seller_id is not null;

create index if not exists idx_reviews_user_id
  on public.reviews (user_id)
  where user_id is not null;

-- Stop future public.users rows from receiving an identity unrelated to Auth.
-- Existing invalid rows remain queryable until the audited cleanup migration.
alter table public.users alter column id drop default;
alter table public.users alter column email drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_id_auth_users_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_id_auth_users_fkey
      foreign key (id) references auth.users (id) on delete cascade
      not valid;
  end if;
end
$$;

-- Backfill the canonical buyer id where the legacy text id already matches Auth.
update public.orders as orders
set buyer_id = auth_user.id
from auth.users as auth_user
where orders.buyer_id is null
  and orders.user_id = auth_user.id::text;

create index if not exists idx_orders_buyer_id
  on public.orders (buyer_id);

-- Ensure every Auth identity has a public profile without overwriting store data.
insert into public.profiles (id, name)
select
  auth_user.id,
  nullif(
    trim(
      coalesce(
        auth_user.raw_user_meta_data ->> 'name',
        auth_user.raw_user_meta_data ->> 'full_name',
        split_part(coalesce(auth_user.email, ''), '@', 1)
      )
    ),
    ''
  )
from auth.users as auth_user
on conflict (id) do nothing;

-- Populate the legacy compatibility table only when neither id nor email conflicts.
-- Email conflicts are intentionally left for the audited cleanup migration.
insert into public.users (id, email, "cartData")
select auth_user.id, auth_user.email, '{}'::jsonb
from auth.users as auth_user
where auth_user.email is not null
  and not exists (
    select 1 from public.users as app_user where app_user.id = auth_user.id
  )
  and not exists (
    select 1
    from public.users as app_user
    where lower(app_user.email) = lower(auth_user.email)
  )
on conflict do nothing;

-- Every registered account is an active buyer immediately. Seller capability is additive
-- and its separate lifecycle never disables the buyer capability.
insert into public.user_roles (user_id, role, source)
select auth_user.id, 'buyer', 'auth_trigger'
from auth.users as auth_user
on conflict (user_id, role) do nothing;

-- Infer existing sellers only from rows they already own.
insert into public.user_roles (user_id, role, source)
select distinct product.seller_id, 'seller', 'inventory_backfill'
from public.products as product
join auth.users as auth_user on auth_user.id = product.seller_id
where product.seller_id is not null
on conflict (user_id, role) do nothing;

insert into public.user_roles (user_id, role, source)
select distinct lend_item.seller_id, 'seller', 'inventory_backfill'
from public.lend_items as lend_item
join auth.users as auth_user on auth_user.id = lend_item.seller_id
where lend_item.seller_id is not null
on conflict (user_id, role) do nothing;

-- Preserve current seller behavior: an identity that already owns inventory is active.
insert into public.seller_accounts (
  user_id,
  status,
  activation_source,
  activated_at
)
select seller.user_id, 'active', 'inventory_backfill', now()
from (
  select product.seller_id as user_id
  from public.products as product
  where product.seller_id is not null
  union
  select lend_item.seller_id as user_id
  from public.lend_items as lend_item
  where lend_item.seller_id is not null
) as seller
join auth.users as auth_user on auth_user.id = seller.user_id
on conflict (user_id) do nothing;

create or replace function public.sync_auth_user_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'full_name',
          split_part(coalesce(new.email, ''), '@', 1)
        )
      ),
      ''
    )
  )
  on conflict (id) do nothing;

  if new.email is not null then
    insert into public.users (id, email, "cartData")
    values (new.id, new.email, '{}'::jsonb)
    on conflict do nothing;
  end if;

  insert into public.user_roles (user_id, role, source)
  values (new.id, 'buyer', 'auth_trigger')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_auth_user_identity() from public, anon, authenticated;

drop trigger if exists on_auth_user_identity_created on auth.users;
create trigger on_auth_user_identity_created
  after insert on auth.users
  for each row execute function public.sync_auth_user_identity();

-- Seller registration is open: any authenticated user can become active immediately.
-- Suspension remains a trusted platform-admin/server operation.
create or replace function public.register_seller_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.user_roles (user_id, role, source)
  values (current_user_id, 'seller', 'self_service')
  on conflict (user_id, role) do nothing;

  insert into public.seller_accounts (
    user_id,
    status,
    activation_source,
    activated_at
  )
  values (current_user_id, 'active', 'self_service', now())
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.register_seller_account() from public, anon;
grant execute on function public.register_seller_account() to authenticated, service_role;

create or replace function public.has_user_role(requested_role text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = lower(trim(requested_role))
  );
$$;

revoke all on function public.has_user_role(text) from public, anon;
grant execute on function public.has_user_role(text) to authenticated, service_role;

create or replace function public.has_active_seller_account()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.seller_accounts
    where user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke all on function public.has_active_seller_account() from public, anon;
grant execute on function public.has_active_seller_account() to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists set_seller_accounts_updated_at on public.seller_accounts;
create trigger set_seller_accounts_updated_at
  before update on public.seller_accounts
  for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;
alter table public.seller_accounts enable row level security;

revoke all on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;
grant all on table public.user_roles to service_role;

revoke all on table public.seller_accounts from anon, authenticated;
grant select on table public.seller_accounts to authenticated;
grant all on table public.seller_accounts to service_role;

drop policy if exists "Users can view their own marketplace roles" on public.user_roles;
create policy "Users can view their own marketplace roles"
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own seller account" on public.seller_accounts;
create policy "Users can view their own seller account"
  on public.seller_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
