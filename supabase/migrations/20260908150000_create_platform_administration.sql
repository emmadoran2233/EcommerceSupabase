-- Platform administration foundation.
-- The existing admin frontend is a seller portal. Platform-wide mutations are
-- intentionally exposed only through audited functions or service-role code.

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  before_data jsonb,
  after_data jsonb,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_action_check check (length(trim(action)) > 0),
  constraint admin_audit_logs_target_type_check check (length(trim(target_type)) > 0)
);

comment on table public.admin_audit_logs is
  'Append-only audit trail for privileged platform administration actions.';

create index if not exists idx_admin_audit_logs_actor_created_at
  on public.admin_audit_logs (actor_user_id, created_at desc);

create index if not exists idx_admin_audit_logs_target_created_at
  on public.admin_audit_logs (target_type, target_id, created_at desc);

create unique index if not exists idx_admin_audit_logs_request_id
  on public.admin_audit_logs (request_id);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'platform_admin'
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

create or replace function public.set_seller_account_status(
  target_user_id uuid,
  requested_status text,
  change_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_status text := lower(trim(requested_status));
  normalized_reason text := nullif(trim(change_reason), '');
  previous_row jsonb;
  updated_row jsonb;
begin
  if actor_id is null or not public.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = '42501';
  end if;

  if normalized_status not in ('active', 'suspended') then
    raise exception 'Unsupported seller status' using errcode = '22023';
  end if;

  if normalized_reason is null then
    raise exception 'A reason is required for seller status changes' using errcode = '22023';
  end if;

  select to_jsonb(seller_account)
  into previous_row
  from public.seller_accounts as seller_account
  where seller_account.user_id = target_user_id
  for update;

  if previous_row is null then
    raise exception 'Seller account not found' using errcode = 'P0002';
  end if;

  update public.seller_accounts as seller_account
  set
    status = normalized_status,
    suspended_at = case
      when normalized_status = 'suspended' then now()
      else null
    end,
    updated_at = now()
  where user_id = target_user_id
  returning to_jsonb(seller_account) into updated_row;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    reason,
    before_data,
    after_data
  )
  values (
    actor_id,
    'seller.status_changed',
    'seller_account',
    target_user_id::text,
    normalized_reason,
    previous_row,
    updated_row
  );
end;
$$;

revoke all on function public.set_seller_account_status(uuid, text, text)
  from public, anon;
grant execute on function public.set_seller_account_status(uuid, text, text)
  to authenticated, service_role;

alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_audit_logs from anon, authenticated;
grant select on table public.admin_audit_logs to authenticated;
grant all on table public.admin_audit_logs to service_role;
grant usage, select on sequence public.admin_audit_logs_id_seq to service_role;
grant select on table public.email_events to authenticated;

drop policy if exists "Platform admins can view audit logs" on public.admin_audit_logs;
create policy "Platform admins can view audit logs"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins can view all user roles" on public.user_roles;
create policy "Platform admins can view all user roles"
  on public.user_roles
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins can view all seller accounts" on public.seller_accounts;
create policy "Platform admins can view all seller accounts"
  on public.seller_accounts
  for select
  to authenticated
  using (public.is_platform_admin());

-- Replace the temporary policy that allowed every authenticated seller-portal
-- user to mutate the global banner.
drop policy if exists "Authenticated users can manage banners" on public.banner;

drop policy if exists "Platform admins can create banners" on public.banner;
create policy "Platform admins can create banners"
  on public.banner
  for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "Platform admins can update banners" on public.banner;
create policy "Platform admins can update banners"
  on public.banner
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Platform admins can delete banners" on public.banner;
create policy "Platform admins can delete banners"
  on public.banner
  for delete
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins can moderate products" on public.products;
create policy "Platform admins can moderate products"
  on public.products
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Platform admins can remove products" on public.products;
create policy "Platform admins can remove products"
  on public.products
  for delete
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins can moderate lend items" on public.lend_items;
create policy "Platform admins can moderate lend items"
  on public.lend_items
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Platform admins can remove lend items" on public.lend_items;
create policy "Platform admins can remove lend items"
  on public.lend_items
  for delete
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins can view all orders" on public.orders;
create policy "Platform admins can view all orders"
  on public.orders
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins can view email events" on public.email_events;
create policy "Platform admins can view email events"
  on public.email_events
  for select
  to authenticated
  using (public.is_platform_admin());
