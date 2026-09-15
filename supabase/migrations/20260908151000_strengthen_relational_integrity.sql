-- Add relational integrity without guessing how ambiguous historical rows should map.
-- NOT VALID constraints protect new writes immediately while allowing a later,
-- audited backfill to repair legacy rows before validation.

alter table public.requests
  add column if not exists requester_id uuid references auth.users (id) on delete set null;

alter table public.banner
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table public.customizations
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.reviews
  add column if not exists product_uuid uuid;

update public.reviews as review
set product_uuid = product.id
from public.products as product
where review.product_uuid is null
  and review.product_id = product.id::text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_product_uuid_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_product_uuid_fkey
      foreign key (product_uuid) references public.products (id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'request_likes_user_id_fkey'
      and conrelid = 'public.request_likes'::regclass
  ) then
    alter table public.request_likes
      add constraint request_likes_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade
      not valid;
  end if;

  if to_regclass('public.order_email_events') is not null
    and not exists (
      select 1 from pg_constraint
      where conname = 'order_email_events_recipient_user_id_fkey'
        and conrelid = 'public.order_email_events'::regclass
    ) then
    alter table public.order_email_events
      add constraint order_email_events_recipient_user_id_fkey
      foreign key (recipient_user_id) references auth.users (id) on delete set null
      not valid;
  end if;
end
$$;

create unique index if not exists idx_carts_id_unique
  on public.carts (id);

create index if not exists idx_orders_buyer_created_at
  on public.orders (buyer_id, created_at desc);

create index if not exists idx_orders_status_created_at
  on public.orders (status, created_at desc);

create index if not exists idx_products_created_at
  on public.products (created_at desc);

create index if not exists idx_reviews_product_uuid_created_at
  on public.reviews (product_uuid, created_at desc)
  where product_uuid is not null;

create index if not exists idx_request_likes_request_user
  on public.request_likes (request_id, user_id);

create index if not exists idx_customizations_user_id
  on public.customizations (user_id)
  where user_id is not null;

create index if not exists idx_requests_requester_id
  on public.requests (requester_id)
  where requester_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_price_nonnegative'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_price_nonnegative
      check (price is null or price >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_stock_nonnegative'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_stock_nonnegative
      check (stock is null or stock >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lend_items_values_valid'
      and conrelid = 'public.lend_items'::regclass
  ) then
    alter table public.lend_items
      add constraint lend_items_values_valid
      check (
        price_per_day >= 0
        and (estimated_value is null or estimated_value >= 0)
        and (stock is null or stock >= 0)
        and (max_rental_days is null or max_rental_days > 0)
        and (available_to is null or available_from is null or available_to >= available_from)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_financial_values_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_financial_values_nonnegative
      check (
        (amount is null or amount >= 0)
        and (rent_fee is null or rent_fee >= 0)
        and (deposit is null or deposit >= 0)
        and (rent_subtotal is null or rent_subtotal >= 0)
        and (purchase_subtotal is null or purchase_subtotal >= 0)
        and (shipping_fee is null or shipping_fee >= 0)
        and (deposit_total is null or deposit_total >= 0)
        and (shipping_rate_amount is null or shipping_rate_amount >= 0)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_items_array'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_items_array
      check (items is null or jsonb_typeof(items) = 'array') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_currency_codes_valid'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_currency_codes_valid
      check (
        (deposit_currency is null or deposit_currency ~ '^[A-Za-z]{3}$')
        and (charge_currency is null or charge_currency ~ '^[A-Za-z]{3}$')
        and (shipping_rate_currency is null or shipping_rate_currency ~ '^[A-Za-z]{3}$')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'requests_likes_nonnegative'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_likes_nonnegative
      check (likes is null or likes >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'email_events_status_valid'
      and conrelid = 'public.email_events'::regclass
  ) then
    alter table public.email_events
      add constraint email_events_status_valid
      check (status in ('pending', 'sent', 'failed')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'email_events_recipient_role_valid'
      and conrelid = 'public.email_events'::regclass
  ) then
    alter table public.email_events
      add constraint email_events_recipient_role_valid
      check (recipient_role in ('buyer', 'seller')) not valid;
  end if;
end
$$;

comment on column public.reviews.product_id is
  'Legacy text product identifier. Migrate readers to product_uuid before removal.';
comment on column public.reviews.product_uuid is
  'Canonical product foreign key introduced for compatibility migration.';
