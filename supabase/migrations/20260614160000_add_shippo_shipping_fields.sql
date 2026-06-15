-- Store shipping label details returned by Shippo.
do $$
begin
  if to_regclass('public.orders') is null then
    raise notice 'Skipping Shippo shipping fields migration because public.orders does not exist.';
    return;
  end if;

  alter table public.orders
    add column if not exists shipping_provider text;

  alter table public.orders
    add column if not exists shipping_carrier text;

  alter table public.orders
    add column if not exists shipping_service text;

  alter table public.orders
    add column if not exists shipping_rate_amount numeric(12,2);

  alter table public.orders
    add column if not exists shipping_rate_currency text;

  alter table public.orders
    add column if not exists shipping_label_url text;

  alter table public.orders
    add column if not exists shipping_transaction_id text;

  alter table public.orders
    add column if not exists shipping_rate_id text;
end $$;
