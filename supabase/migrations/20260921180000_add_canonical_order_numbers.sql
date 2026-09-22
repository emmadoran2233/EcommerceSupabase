-- Keep bigint ids for relational joins and expose an immutable business order
-- number for customers, sellers, emails, and external-provider metadata.

alter table public.orders
  add column if not exists order_number text;

create or replace function public.format_order_number(
  p_created_at timestamptz,
  p_order_id bigint,
  p_entropy uuid default gen_random_uuid()
)
returns text
language sql
volatile
set search_path = ''
as $$
  select
    to_char(coalesce(p_created_at, now()) at time zone 'UTC', 'YYYYMMDDHH24MISS')
    || '-'
    || upper(substr(replace(p_entropy::text, '-', ''), 1, 6))
    || '-'
    || lpad(p_order_id::text, 8, '0');
$$;

create or replace function public.set_order_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Historical rows are allowed to move from NULL to their first canonical
  -- number during this migration. Once assigned, the number is immutable.
  if tg_op = 'UPDATE'
    and old.order_number is not null
    and new.order_number is distinct from old.order_number then
    raise exception 'Order number is immutable' using errcode = '22023';
  end if;

  if new.order_number is null or trim(new.order_number) = '' then
    new.order_number := public.format_order_number(
      coalesce(new.created_at, new.date, now()),
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists set_orders_order_number on public.orders;
create trigger set_orders_order_number
  before insert or update of order_number on public.orders
  for each row execute function public.set_order_number();

update public.orders
set order_number = public.format_order_number(
  coalesce(created_at, date),
  id
)
where order_number is null or trim(order_number) = '';

alter table public.orders
  alter column order_number set not null;

alter table public.orders
  drop constraint if exists orders_order_number_format_check;
alter table public.orders
  add constraint orders_order_number_format_check
  check (order_number ~ '^[0-9]{14}-[A-F0-9]{6}-[0-9]{8,}$');

create unique index if not exists orders_order_number_unique
  on public.orders (order_number);

comment on column public.orders.order_number is
  'Immutable public order identifier: UTC timestamp + short id + integer sequence.';
comment on column public.orders.id is
  'Internal relational primary key. Do not expose as the customer-facing order number.';
comment on column public.orders.order_id is
  'Legacy provider/compatibility reference; scheduled for removal after reconciliation.';
