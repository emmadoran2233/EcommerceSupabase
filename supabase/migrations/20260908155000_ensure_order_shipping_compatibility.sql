-- The historical Shippo migration could be marked as applied after safely skipping
-- an environment where public.orders did not yet exist. Ensure the one missing
-- compatibility column exists before relational fulfillment backfill reads it.

alter table public.orders
  add column if not exists shipping_transaction_id text;

