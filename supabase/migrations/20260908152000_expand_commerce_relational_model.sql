-- Add normalized commerce tables beside the legacy JSON structures.
-- No existing application reader is switched by this migration.

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  line_number integer not null,
  product_id uuid references public.products (id) on delete set null,
  seller_id uuid references auth.users (id) on delete set null,
  item_type text not null default 'purchase'
    check (item_type in ('purchase', 'rental')),
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount numeric(12, 2) not null check (unit_amount >= 0),
  line_amount numeric(12, 2) not null check (line_amount >= 0),
  currency text not null default 'usd' check (currency ~ '^[A-Za-z]{3}$'),
  size text,
  customization jsonb,
  rental_start_date date,
  rental_end_date date,
  product_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_items_line_number_positive check (line_number > 0),
  constraint order_items_rental_dates_valid check (
    rental_end_date is null
    or rental_start_date is null
    or rental_end_date >= rental_start_date
  ),
  constraint order_items_order_line_unique unique (order_id, line_number)
);

comment on table public.order_items is
  'Normalized immutable order line snapshots. Legacy orders.items remains during migration.';

create index if not exists idx_order_items_order_id
  on public.order_items (order_id);

create index if not exists idx_order_items_seller_order
  on public.order_items (seller_id, order_id)
  where seller_id is not null;

create index if not exists idx_order_items_product_id
  on public.order_items (product_id)
  where product_id is not null;

create table if not exists public.seller_fulfillments (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  seller_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'packing', 'shipped', 'delivered', 'cancelled')),
  shipping_provider text,
  shipping_carrier text,
  shipping_service text,
  shipping_rate_amount numeric(12, 2)
    check (shipping_rate_amount is null or shipping_rate_amount >= 0),
  shipping_rate_currency text
    check (shipping_rate_currency is null or shipping_rate_currency ~ '^[A-Za-z]{3}$'),
  shipping_rate_id text,
  shipping_transaction_id text,
  shipping_label_url text,
  tracking_number text,
  tracking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_fulfillments_order_seller_unique unique (order_id, seller_id)
);

comment on table public.seller_fulfillments is
  'Per-seller fulfillment state for multi-seller orders.';

create index if not exists idx_seller_fulfillments_seller_status
  on public.seller_fulfillments (seller_id, status, created_at desc);

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders (id) on delete cascade,
  provider text not null check (length(trim(provider)) > 0),
  provider_payment_id text,
  status text not null default 'pending'
    check (status in (
      'pending',
      'authorized',
      'paid',
      'failed',
      'cancelled',
      'partially_refunded',
      'refunded'
    )),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Za-z]{3}$'),
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.order_payments is
  'Provider-neutral payment state using integer minor units. Provider secrets never belong here.';

create index if not exists idx_order_payments_order_created_at
  on public.order_payments (order_id, created_at desc);

create unique index if not exists idx_order_payments_provider_reference
  on public.order_payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.cart_items (
  id bigint generated always as identity primary key,
  cart_id uuid not null,
  user_id uuid not null,
  line_key text not null,
  product_id uuid references public.products (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  size text,
  customization jsonb,
  rental_start_date date,
  rental_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_cart_user_fkey
    foreign key (cart_id, user_id)
    references public.carts (id, user_id)
    on delete cascade,
  constraint cart_items_cart_line_unique unique (cart_id, line_key),
  constraint cart_items_rental_dates_valid check (
    rental_end_date is null
    or rental_start_date is null
    or rental_end_date >= rental_start_date
  )
);

comment on table public.cart_items is
  'Normalized cart lines. Legacy carts.items remains during migration.';

create index if not exists idx_cart_items_user_cart
  on public.cart_items (user_id, cart_id);

create index if not exists idx_cart_items_product_id
  on public.cart_items (product_id)
  where product_id is not null;

drop trigger if exists set_seller_fulfillments_updated_at on public.seller_fulfillments;
create trigger set_seller_fulfillments_updated_at
  before update on public.seller_fulfillments
  for each row execute function public.set_updated_at();

drop trigger if exists set_order_payments_updated_at on public.order_payments;
create trigger set_order_payments_updated_at
  before update on public.order_payments
  for each row execute function public.set_updated_at();

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

alter table public.order_items enable row level security;
alter table public.seller_fulfillments enable row level security;
alter table public.order_payments enable row level security;
alter table public.cart_items enable row level security;

revoke all on table public.order_items from anon, authenticated;
revoke all on table public.seller_fulfillments from anon, authenticated;
revoke all on table public.order_payments from anon, authenticated;
revoke all on table public.cart_items from anon, authenticated;

grant select on table public.order_items to authenticated;
grant select on table public.seller_fulfillments to authenticated;
grant select on table public.order_payments to authenticated;
grant select, insert, update, delete on table public.cart_items to authenticated;

grant usage, select on sequence public.cart_items_id_seq to authenticated;

grant all on table public.order_items to service_role;
grant all on table public.seller_fulfillments to service_role;
grant all on table public.order_payments to service_role;
grant all on table public.cart_items to service_role;
grant usage, select on sequence public.order_items_id_seq to service_role;
grant usage, select on sequence public.seller_fulfillments_id_seq to service_role;
grant usage, select on sequence public.cart_items_id_seq to service_role;

drop policy if exists "Buyers can view their order items" on public.order_items;
create policy "Buyers can view their order items"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and (
          orders.buyer_id = (select auth.uid())
          or orders.user_id = (select auth.uid())::text
        )
    )
  );

drop policy if exists "Sellers can view their order items" on public.order_items;
create policy "Sellers can view their order items"
  on public.order_items
  for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "Platform admins can view all order items" on public.order_items;
create policy "Platform admins can view all order items"
  on public.order_items
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Buyers can view their fulfillments" on public.seller_fulfillments;
create policy "Buyers can view their fulfillments"
  on public.seller_fulfillments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = seller_fulfillments.order_id
        and (
          orders.buyer_id = (select auth.uid())
          or orders.user_id = (select auth.uid())::text
        )
    )
  );

drop policy if exists "Sellers can view their fulfillments" on public.seller_fulfillments;
create policy "Sellers can view their fulfillments"
  on public.seller_fulfillments
  for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "Platform admins can view all fulfillments" on public.seller_fulfillments;
create policy "Platform admins can view all fulfillments"
  on public.seller_fulfillments
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Buyers can view their payment status" on public.order_payments;
create policy "Buyers can view their payment status"
  on public.order_payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_payments.order_id
        and (
          orders.buyer_id = (select auth.uid())
          or orders.user_id = (select auth.uid())::text
        )
    )
  );

drop policy if exists "Platform admins can view all payment status" on public.order_payments;
create policy "Platform admins can view all payment status"
  on public.order_payments
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Users can view their cart items" on public.cart_items;
create policy "Users can view their cart items"
  on public.cart_items
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create their cart items" on public.cart_items;
create policy "Users can create their cart items"
  on public.cart_items
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their cart items" on public.cart_items;
create policy "Users can update their cart items"
  on public.cart_items
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their cart items" on public.cart_items;
create policy "Users can delete their cart items"
  on public.cart_items
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
