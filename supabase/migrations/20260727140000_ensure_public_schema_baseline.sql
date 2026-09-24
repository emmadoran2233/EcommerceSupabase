-- Idempotent baseline for tables that predate version-controlled migrations.
-- Existing remote tables are preserved; a fresh environment can reconstruct the
-- application schema before later RLS and normalization migrations run.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12, 2),
  category text,
  sub_category text,
  bestseller boolean not null default false,
  sizes text[],
  images text[],
  created_at timestamptz not null default now(),
  stock integer not null default 1,
  is_customizable boolean not null default false,
  seller_id uuid references auth.users (id) on delete set null,
  rentable boolean not null default false
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  bio text,
  intro text,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  "cartData" jsonb not null default '{}'::jsonb
);

create table if not exists public.carts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.banner (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  likes bigint not null default 0,
  created_at timestamptz not null default now(),
  image_url text
);

create table if not exists public.lend_items (
  id bigint generated always as identity primary key,
  seller_id uuid references auth.users (id) on delete set null,
  name text not null,
  description text,
  category text,
  image_urls text[] not null default '{}',
  estimated_value numeric(12, 2),
  price_per_day numeric(12, 2) not null,
  max_rental_days integer not null default 30,
  stock integer not null default 1,
  available_from date,
  available_to date,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  items jsonb,
  address jsonb,
  paymentmethod text,
  payment boolean not null default false,
  date timestamptz not null default now(),
  amount numeric(12, 2),
  status text not null default 'Order Placed',
  created_at timestamptz not null default now(),
  user_id text,
  seller_id uuid references auth.users (id) on delete set null,
  order_id text unique,
  buyer_id uuid references auth.users (id) on delete set null,
  rent_fee numeric(12, 2),
  deposit numeric(12, 2),
  rent_subtotal numeric(12, 2) not null default 0,
  purchase_subtotal numeric(12, 2) not null default 0,
  shipping_fee numeric(12, 2) not null default 0,
  deposit_total numeric(12, 2) not null default 0,
  deposit_currency text not null default 'usd',
  charge_currency text not null default 'usd',
  deposit_hold_status text not null default 'none',
  rent_breakdown jsonb not null default '[]'::jsonb,
  deposit_metadata jsonb not null default '{}'::jsonb,
  deposit_payment_intent_id text,
  deposit_payment_method_id text,
  deposit_customer_id text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  deposit_last_authorized_at timestamptz,
  deposit_authorization_expires_at timestamptz,
  deposit_next_action_at timestamptz,
  deposit_rental_end_date timestamptz,
  deposit_reauthorization_count integer not null default 0,
  label_out_url text,
  label_return_url text,
  tracking_out text,
  tracking_return text,
  shipping_tracking_number text,
  shipping_tracking_url text,
  shipping_provider text,
  shipping_carrier text,
  shipping_service text,
  shipping_rate_amount numeric(12, 2),
  shipping_rate_currency text,
  shipping_label_url text,
  shipping_transaction_id text,
  shipping_rate_id text
);

create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  product_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  user_name text not null,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customizations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  custom_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.request_likes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.order_email_events (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders (id) on delete cascade,
  recipient_user_id uuid references auth.users (id) on delete set null,
  recipient_email text not null,
  event_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id bigint references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  recipient_email text not null,
  recipient_role text not null,
  seller_id uuid references auth.users (id) on delete set null,
  subject text not null,
  status text not null default 'pending',
  provider_id text,
  error_message text,
  idempotency_key text not null unique,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_deposit_next_action
  on public.orders (deposit_hold_status, deposit_next_action_at);

create index if not exists idx_orders_deposit_payment_intent
  on public.orders (deposit_payment_intent_id);

create index if not exists idx_order_email_events_order_id
  on public.order_email_events (order_id);

create index if not exists idx_order_email_events_recipient_user_id
  on public.order_email_events (recipient_user_id)
  where recipient_user_id is not null;

-- Add compatibility columns when an older remote table already exists.
alter table public.customizations
  add column if not exists user_id uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'email_events_order_id_fkey'
      and conrelid = 'public.email_events'::regclass
  ) then
    alter table public.email_events
      add constraint email_events_order_id_fkey
      foreign key (order_id) references public.orders (id) on delete cascade
      not valid;
  end if;
end
$$;
