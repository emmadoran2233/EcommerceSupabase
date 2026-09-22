-- Keep Shippo's external side effect seller-scoped and concurrency-safe.

alter table public.seller_fulfillments
  add column if not exists shipping_purchase_token uuid,
  add column if not exists shipping_purchase_started_at timestamptz;

create unique index if not exists seller_fulfillments_shipping_transaction_unique
  on public.seller_fulfillments (shipping_transaction_id)
  where shipping_transaction_id is not null;

create or replace function public.reserve_seller_shippo_label(
  p_order_id bigint,
  p_rate_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_rate_id text := nullif(trim(p_rate_id), '');
  purchase_token uuid := gen_random_uuid();
  existing_transaction_id text;
  existing_purchase_token uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_rate_id is null then
    raise exception 'Rate id is required' using errcode = '22023';
  end if;

  -- External purchases require canonical relational ownership. Do not fall
  -- back to seller ids supplied in the legacy orders.items JSON.
  if not exists (
    select 1
    from public.order_items as order_item
    where order_item.order_id = p_order_id
      and order_item.seller_id = current_user_id
  ) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  insert into public.seller_fulfillments (order_id, seller_id)
  select distinct order_item.order_id, order_item.seller_id
  from public.order_items as order_item
  where order_item.order_id = p_order_id
    and order_item.seller_id is not null
  on conflict (order_id, seller_id) do nothing;

  select shipping_transaction_id, shipping_purchase_token
  into existing_transaction_id, existing_purchase_token
  from public.seller_fulfillments
  where order_id = p_order_id
    and seller_id = current_user_id
  for update;

  if existing_transaction_id is not null then
    raise exception 'Label already purchased' using errcode = '23505';
  end if;
  if existing_purchase_token is not null then
    raise exception 'Label purchase already in progress' using errcode = '55P03';
  end if;

  update public.seller_fulfillments
  set
    shipping_rate_id = normalized_rate_id,
    shipping_purchase_token = purchase_token,
    shipping_purchase_started_at = now(),
    updated_at = now()
  where order_id = p_order_id
    and seller_id = current_user_id;

  return purchase_token;
end;
$$;

create or replace function public.record_seller_shippo_label(
  p_order_id bigint,
  p_purchase_token uuid,
  p_rate_id text,
  p_transaction_id text,
  p_carrier text default null,
  p_service text default null,
  p_rate_amount numeric default null,
  p_rate_currency text default 'USD',
  p_label_url text default null,
  p_tracking_number text default null,
  p_tracking_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_rate_id text := nullif(trim(p_rate_id), '');
  normalized_transaction_id text := nullif(trim(p_transaction_id), '');
  normalized_currency text := upper(nullif(trim(p_rate_currency), ''));
  fulfillment_count integer;
  aggregate_status text;
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_purchase_token is null then
    raise exception 'Purchase token is required' using errcode = '22023';
  end if;
  if normalized_rate_id is null or normalized_transaction_id is null then
    raise exception 'Shippo rate and transaction ids are required' using errcode = '22023';
  end if;
  if normalized_currency is null or normalized_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid shipping currency' using errcode = '22023';
  end if;
  if p_rate_amount is not null
    and (p_rate_amount < 0 or p_rate_amount = 'NaN'::numeric) then
    raise exception 'Invalid shipping rate amount' using errcode = '22023';
  end if;

  update public.seller_fulfillments
  set
    status = 'shipped',
    shipping_provider = 'shippo',
    shipping_carrier = nullif(trim(p_carrier), ''),
    shipping_service = nullif(trim(p_service), ''),
    shipping_rate_amount = p_rate_amount,
    shipping_rate_currency = normalized_currency,
    shipping_rate_id = normalized_rate_id,
    shipping_transaction_id = normalized_transaction_id,
    shipping_label_url = nullif(trim(p_label_url), ''),
    tracking_number = nullif(trim(p_tracking_number), ''),
    tracking_url = nullif(trim(p_tracking_url), ''),
    shipping_purchase_token = null,
    shipping_purchase_started_at = null,
    updated_at = now()
  where order_id = p_order_id
    and seller_id = current_user_id
    and shipping_purchase_token = p_purchase_token
    and shipping_transaction_id is null;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Shippo purchase reservation not found' using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    case
      when bool_and(status = 'cancelled') then 'Cancelled'
      when bool_and(status in ('delivered', 'cancelled')) then 'Delivered'
      when bool_or(status = 'out_for_delivery') then 'Out for delivery'
      when bool_or(status in ('shipped', 'delivered')) then 'Shipped'
      when bool_or(status = 'packing') then 'Packing'
      else 'Order Placed'
    end
  into fulfillment_count, aggregate_status
  from public.seller_fulfillments
  where order_id = p_order_id;

  update public.orders
  set
    status = aggregate_status,
    shipping_provider = case when fulfillment_count = 1 then 'shippo' else null end,
    shipping_carrier = case when fulfillment_count = 1 then nullif(trim(p_carrier), '') else null end,
    shipping_service = case when fulfillment_count = 1 then nullif(trim(p_service), '') else null end,
    shipping_rate_amount = case when fulfillment_count = 1 then p_rate_amount else null end,
    shipping_rate_currency = case when fulfillment_count = 1 then normalized_currency else null end,
    shipping_rate_id = case when fulfillment_count = 1 then normalized_rate_id else null end,
    shipping_transaction_id = case when fulfillment_count = 1 then normalized_transaction_id else null end,
    shipping_label_url = case when fulfillment_count = 1 then nullif(trim(p_label_url), '') else null end,
    shipping_tracking_number = case when fulfillment_count = 1 then nullif(trim(p_tracking_number), '') else null end,
    shipping_tracking_url = case when fulfillment_count = 1 then nullif(trim(p_tracking_url), '') else null end
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'seller_id', current_user_id,
    'fulfillment_status', 'shipped',
    'order_status', aggregate_status,
    'transaction_id', normalized_transaction_id
  );
end;
$$;

create or replace function public.release_seller_shippo_reservation(
  p_order_id bigint,
  p_purchase_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.seller_fulfillments
  set
    shipping_purchase_token = null,
    shipping_purchase_started_at = null,
    updated_at = now()
  where order_id = p_order_id
    and seller_id = current_user_id
    and shipping_purchase_token = p_purchase_token
    and shipping_transaction_id is null;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

comment on function public.reserve_seller_shippo_label(bigint, text) is
  'Atomically reserves one seller fulfillment before a Shippo label purchase.';
comment on function public.record_seller_shippo_label(bigint, uuid, text, text, text, text, numeric, text, text, text, text) is
  'Stores one authenticated seller Shippo transaction and derives compatibility order fields.';
comment on function public.release_seller_shippo_reservation(bigint, uuid) is
  'Releases a Shippo reservation only when the provider explicitly rejects the purchase.';

revoke all on function public.reserve_seller_shippo_label(bigint, text)
  from public, anon;
revoke all on function public.record_seller_shippo_label(bigint, uuid, text, text, text, text, numeric, text, text, text, text)
  from public, anon;
revoke all on function public.release_seller_shippo_reservation(bigint, uuid)
  from public, anon;

grant execute on function public.reserve_seller_shippo_label(bigint, text)
  to authenticated;
grant execute on function public.record_seller_shippo_label(bigint, uuid, text, text, text, text, numeric, text, text, text, text)
  to authenticated;
grant execute on function public.release_seller_shippo_reservation(bigint, uuid)
  to authenticated;
