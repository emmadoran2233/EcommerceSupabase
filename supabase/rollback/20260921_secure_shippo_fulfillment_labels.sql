begin;

drop function if exists public.release_seller_shippo_reservation(bigint, uuid);
drop function if exists public.record_seller_shippo_label(
  bigint, uuid, text, text, text, text, numeric, text, text, text, text
);
drop function if exists public.reserve_seller_shippo_label(bigint, text);

drop index if exists public.seller_fulfillments_shipping_transaction_unique;

alter table public.seller_fulfillments
  drop column if exists shipping_purchase_started_at,
  drop column if exists shipping_purchase_token;

commit;
