-- Run after the relational backfill. Counts only; no PII is returned.

select 'orders_with_legacy_items' as check_name, count(*) as source_rows
from public.orders
where jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
union all
select 'orders_with_normalized_items', count(distinct order_id)
from public.order_items
union all
select 'orders_still_without_normalized_items', count(*)
from public.orders as legacy_order
where jsonb_typeof(legacy_order.items) = 'array'
  and jsonb_array_length(legacy_order.items) > 0
  and not exists (
    select 1 from public.order_items where order_items.order_id = legacy_order.id
  )
union all
select 'single_seller_orders_without_fulfillment', count(*)
from (
  select order_id
  from public.order_items
  where seller_id is not null
  group by order_id
  having count(distinct seller_id) = 1
) as single_seller_order
where not exists (
  select 1
  from public.seller_fulfillments
  where seller_fulfillments.order_id = single_seller_order.order_id
)
union all
select 'carts_with_legacy_items', count(*)
from public.carts
where items not in ('{}'::jsonb, '[]'::jsonb)
union all
select 'carts_with_normalized_items', count(distinct cart_id)
from public.cart_items
union all
select 'paid_legacy_orders_without_payment_rows', count(*)
from public.orders as legacy_order
where legacy_order.payment is true
  and not exists (
    select 1 from public.order_payments where order_payments.order_id = legacy_order.id
  );

