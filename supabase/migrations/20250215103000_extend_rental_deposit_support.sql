-- Extend orders table to track rental rent/deposit breakdowns and Stripe artifact ids
alter table public.orders
    add column if not exists rent_subtotal numeric(12,2) not null default 0;

alter table public.orders
    add column if not exists purchase_subtotal numeric(12,2) not null default 0;

alter table public.orders
    add column if not exists shipping_fee numeric(12,2) not null default 0;

alter table public.orders
    add column if not exists rent_breakdown jsonb not null default '[]'::jsonb;

alter table public.orders
    add column if not exists deposit_total numeric(12,2) not null default 0;

alter table public.orders
    add column if not exists deposit_currency text not null default 'usd';

alter table public.orders
    add column if not exists charge_currency text not null default 'usd';

alter table public.orders
    add column if not exists deposit_hold_status text not null default 'none';

alter table public.orders
    add column if not exists deposit_payment_intent_id text;

alter table public.orders
    add column if not exists deposit_payment_method_id text;

alter table public.orders
    add column if not exists deposit_customer_id text;

alter table public.orders
    add column if not exists deposit_last_authorized_at timestamptz;

alter table public.orders
    add column if not exists deposit_authorization_expires_at timestamptz;

alter table public.orders
    add column if not exists deposit_next_action_at timestamptz;

alter table public.orders
    add column if not exists deposit_reauthorization_count integer not null default 0;

alter table public.orders
    add column if not exists deposit_metadata jsonb not null default '{}'::jsonb;

alter table public.orders
    add column if not exists deposit_rental_end_date timestamptz;

alter table public.orders
    add column if not exists stripe_session_id text;

alter table public.orders
    add column if not exists stripe_payment_intent_id text;

create index if not exists idx_orders_deposit_next_action
    on public.orders (deposit_hold_status, deposit_next_action_at);

create index if not exists idx_orders_deposit_payment_intent
    on public.orders (deposit_payment_intent_id);
