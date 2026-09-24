-- Read-only release-gate report for retiring legacy commerce columns.
-- Run after migrations and backfill. The report returns counts only and no PII.
-- A non-zero count requires investigation; it must never be auto-corrected here.

with checks as (
  select 'orders_missing_order_number'::text as check_name, count(*)::bigint as affected_rows
  from public.orders
  where order_number is null or trim(order_number) = ''

  union all
  select 'orders_with_invalid_order_number', count(*)
  from public.orders
  where order_number !~ '^[0-9]{14}-[A-F0-9]{6}-[0-9]{8,}$'

  union all
  select 'duplicate_order_numbers', coalesce(sum(duplicate_count - 1), 0)::bigint
  from (
    select count(*)::bigint as duplicate_count
    from public.orders
    group by order_number
    having count(*) > 1
  ) as duplicate_groups

  union all
  select 'orders_missing_buyer_id', count(*)
  from public.orders
  where buyer_id is null

  union all
  select 'legacy_orders_without_normalized_items', count(*)
  from public.orders as legacy_order
  where jsonb_typeof(legacy_order.items) = 'array'
    and jsonb_array_length(legacy_order.items) > 0
    and not exists (
      select 1 from public.order_items where order_items.order_id = legacy_order.id
    )

  union all
  select 'orders_with_legacy_normalized_line_count_mismatch', count(*)
  from public.orders as legacy_order
  where jsonb_typeof(legacy_order.items) = 'array'
    and jsonb_array_length(legacy_order.items) <> (
      select count(*) from public.order_items where order_items.order_id = legacy_order.id
    )

  union all
  select 'order_items_missing_product_id', count(*)
  from public.order_items
  where product_id is null

  union all
  select 'order_items_missing_seller_id', count(*)
  from public.order_items
  where seller_id is null

  union all
  select 'orders_with_non_contiguous_line_numbers', count(*)
  from (
    select order_id
    from public.order_items
    group by order_id
    having min(line_number) <> 1
       or max(line_number) <> count(*)
  ) as orders_with_line_gaps

  union all
  select 'seller_fulfillments_missing_for_normalized_sellers', count(*)
  from (
    select distinct order_item.order_id, order_item.seller_id
    from public.order_items as order_item
    where order_item.seller_id is not null
    except
    select fulfillment.order_id, fulfillment.seller_id
    from public.seller_fulfillments as fulfillment
    where fulfillment.seller_id is not null
  ) as missing_fulfillments

  union all
  select 'seller_fulfillments_without_matching_order_items', count(*)
  from public.seller_fulfillments as fulfillment
  where fulfillment.seller_id is not null
    and not exists (
      select 1
      from public.order_items as order_item
      where order_item.order_id = fulfillment.order_id
        and order_item.seller_id = fulfillment.seller_id
    )

  union all
  select 'multi_seller_orders_with_ambiguous_shared_shipping', count(*)
  from public.orders as legacy_order
  join (
    select order_id
    from public.order_items
    where seller_id is not null
    group by order_id
    having count(distinct seller_id) > 1
  ) as multi_seller_order on multi_seller_order.order_id = legacy_order.id
  where legacy_order.shipping_provider is not null
     or legacy_order.shipping_carrier is not null
     or legacy_order.shipping_service is not null
     or legacy_order.shipping_transaction_id is not null
     or legacy_order.shipping_label_url is not null
     or legacy_order.shipping_tracking_number is not null
     or legacy_order.shipping_tracking_url is not null
     or legacy_order.tracking_out is not null
     or legacy_order.tracking_return is not null

  union all
  select 'orders_with_amount_mismatch', count(*)
  from public.orders as customer_order
  where exists (
      select 1 from public.order_items where order_items.order_id = customer_order.id
    )
    and round(coalesce(customer_order.amount, 0), 2) <>
      round(
        coalesce((
          select sum(order_item.line_amount)
          from public.order_items as order_item
          where order_item.order_id = customer_order.id
        ), 0) + coalesce(customer_order.shipping_fee, 0),
        2
      )

  union all
  select 'legacy_carts_without_normalized_items', count(*)
  from public.carts as legacy_cart
  where legacy_cart.items not in ('{}'::jsonb, '[]'::jsonb)
    and not exists (
      select 1 from public.cart_items where cart_items.cart_id = legacy_cart.id
    )

  union all
  select 'paid_orders_without_payment_rows', count(*)
  from public.orders as paid_order
  where paid_order.payment is true
    and not exists (
      select 1 from public.order_payments where order_payments.order_id = paid_order.id
    )
)
select check_name, affected_rows
from checks
order by check_name;

-- Informational totals make review easier without exposing customer data.
select 'orders' as entity, count(*) as rows from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'seller_fulfillments', count(*) from public.seller_fulfillments
union all select 'order_payments', count(*) from public.order_payments
union all select 'carts', count(*) from public.carts
union all select 'cart_items', count(*) from public.cart_items
order by entity;
