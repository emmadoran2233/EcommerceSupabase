begin;

drop trigger if exists set_orders_order_number on public.orders;
drop function if exists public.set_order_number();
drop function if exists public.format_order_number(timestamptz, bigint, uuid);
drop index if exists public.orders_order_number_unique;

alter table public.orders
  drop constraint if exists orders_order_number_format_check,
  drop column if exists order_number;

commit;
