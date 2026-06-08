-- Add seller-provided shipping tracking details to orders.
do $$
begin
  if to_regclass('public.orders') is null then
    raise notice 'Skipping order shipping tracking migration because public.orders does not exist.';
    return;
  end if;

  alter table public.orders
    add column if not exists shipping_tracking_number text;

  alter table public.orders
    add column if not exists shipping_tracking_url text;
end $$;
