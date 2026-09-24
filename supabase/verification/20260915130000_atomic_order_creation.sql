-- Read-only production reconciliation for orders created through the atomic RPC.

select 'atomic_orders_without_lines' as check_name, count(*) as issue_count
from public.orders as orders
where orders.checkout_request_id is not null
  and not exists (
    select 1
    from public.order_items as order_item
    where order_item.order_id = orders.id
  );

select 'duplicate_checkout_request_ids' as check_name, count(*) as issue_count
from (
  select checkout_request_id
  from public.orders
  where checkout_request_id is not null
  group by checkout_request_id
  having count(*) > 1
) as duplicate_request;

select 'order_items_with_catalog_seller_mismatch' as check_name, count(*) as issue_count
from public.order_items as order_item
join public.products as product on product.id = order_item.product_id
where order_item.order_id in (
    select id from public.orders where checkout_request_id is not null
  )
  and order_item.seller_id is distinct from product.seller_id;

select 'atomic_seller_orders_without_fulfillment' as check_name, count(*) as issue_count
from (
  select distinct order_item.order_id, order_item.seller_id
  from public.order_items as order_item
  join public.orders as orders on orders.id = order_item.order_id
  where orders.checkout_request_id is not null
    and order_item.seller_id is not null
) as expected_fulfillment
where not exists (
  select 1
  from public.seller_fulfillments as fulfillment
  where fulfillment.order_id = expected_fulfillment.order_id
    and fulfillment.seller_id = expected_fulfillment.seller_id
);
