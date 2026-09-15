-- Restore the storefront to direct orders inserts before running this rollback.
-- Existing orders and their normalized lines are retained.

begin;

drop function if exists public.create_order_with_items(jsonb);
drop index if exists public.idx_orders_checkout_request_id;

alter table public.orders
  drop column if exists checkout_request_id;

commit;
