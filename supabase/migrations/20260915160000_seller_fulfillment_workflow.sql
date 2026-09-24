-- Route seller-owned status and manual tracking updates through the seller's
-- fulfillment row. Sellers no longer update the shared order header directly.

alter table public.seller_fulfillments
  drop constraint if exists seller_fulfillments_status_check;

alter table public.seller_fulfillments
  add constraint seller_fulfillments_status_check
  check (status in (
    'pending',
    'packing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled'
  ));

create or replace function public.update_seller_fulfillment(
  p_order_id bigint,
  p_status text,
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
  normalized_status text := lower(trim(coalesce(p_status, '')));
  normalized_tracking_number text := nullif(trim(p_tracking_number), '');
  normalized_tracking_url text := nullif(trim(p_tracking_url), '');
  fulfillment_count integer;
  aggregate_status text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_status not in (
    'pending',
    'packing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled'
  ) then
    raise exception 'Unsupported fulfillment status' using errcode = '22023';
  end if;

  if not public.seller_can_access_order(p_order_id, current_user_id) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  -- Historical multi-seller orders may predate fulfillment backfill. Materialize
  -- every seller that can be derived from normalized lines before aggregating.
  insert into public.seller_fulfillments (order_id, seller_id)
  select distinct order_item.order_id, order_item.seller_id
  from public.order_items as order_item
  where order_item.order_id = p_order_id
    and order_item.seller_id is not null
  on conflict (order_id, seller_id) do nothing;

  insert into public.seller_fulfillments (
    order_id,
    seller_id,
    status,
    tracking_number,
    tracking_url
  )
  values (
    p_order_id,
    current_user_id,
    normalized_status,
    normalized_tracking_number,
    normalized_tracking_url
  )
  on conflict (order_id, seller_id) do update
  set
    status = excluded.status,
    tracking_number = excluded.tracking_number,
    tracking_url = excluded.tracking_url,
    updated_at = now();

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
    shipping_tracking_number = case
      when fulfillment_count = 1 then normalized_tracking_number
      else shipping_tracking_number
    end,
    shipping_tracking_url = case
      when fulfillment_count = 1 then normalized_tracking_url
      else shipping_tracking_url
    end
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'seller_id', current_user_id,
    'fulfillment_status', normalized_status,
    'order_status', aggregate_status
  );
end;
$$;

comment on function public.update_seller_fulfillment(bigint, text, text, text) is
  'Updates one authenticated seller fulfillment and derives the compatibility order status.';

revoke all on function public.update_seller_fulfillment(bigint, text, text, text)
  from public, anon;
grant execute on function public.update_seller_fulfillment(bigint, text, text, text)
  to authenticated, service_role;

drop policy if exists "Sellers can update orders containing their items"
  on public.orders;
