-- Create one fulfillment aggregate for every normalized order/seller pair.
-- Shared legacy shipping data is deliberately not copied to multi-seller rows,
-- because there is no deterministic way to know which seller owned the parcel.

create or replace function public.backfill_missing_seller_fulfillments()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_rows bigint;
begin
  insert into public.seller_fulfillments (order_id, seller_id, status)
  select distinct
    order_item.order_id,
    order_item.seller_id,
    'pending'
  from public.order_items as order_item
  where order_item.seller_id is not null
  on conflict (order_id, seller_id) do nothing;

  get diagnostics inserted_rows = row_count;
  return inserted_rows;
end;
$$;

comment on function public.backfill_missing_seller_fulfillments() is
  'Idempotently creates missing per-seller fulfillment aggregates without guessing shared legacy tracking ownership.';

revoke all on function public.backfill_missing_seller_fulfillments()
  from public, anon, authenticated;
grant execute on function public.backfill_missing_seller_fulfillments()
  to service_role;

select public.backfill_missing_seller_fulfillments();
