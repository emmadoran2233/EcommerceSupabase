begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select has_column('public', 'orders', 'order_number', 'orders should expose a public order number');
select col_not_null('public', 'orders', 'order_number', 'public order numbers should be required');
select has_function(
  'public', 'format_order_number', array['timestamp with time zone', 'bigint', 'uuid'],
  'order number formatting should be centralized'
);
select has_trigger(
  'public', 'orders', 'set_orders_order_number',
  'new orders should receive an order number automatically'
);
select has_index(
  'public', 'orders', 'orders_order_number_unique',
  'public order numbers should be unique'
);

select is(
  public.format_order_number(
    '2026-09-21 21:45:30+00'::timestamptz,
    123,
    'abcdef12-3456-4789-8abc-def012345678'::uuid
  ),
  '20260921214530-ABCDEF-00000123',
  'the format should be UTC timestamp, short id, and padded integer id'
);

insert into public.orders (items, amount)
values ('[]'::jsonb, 0)
returning id, order_number \gset generated_order_

select matches(
  :'generated_order_order_number'::text,
  '^[0-9]{14}-[A-F0-9]{6}-[0-9]{8,}$',
  'the insert trigger should generate a correctly formatted order number'
);

select is(
  right(:'generated_order_order_number'::text, 8),
  lpad(:'generated_order_id'::text, 8, '0'),
  'the public number should retain the internal integer sequence'
);

select throws_like(
  format(
    'insert into public.orders (items, amount, order_number) values (%L::jsonb, 0, %L)',
    '[]',
    'invalid-order-number'
  ),
  '%orders_order_number_format_check%',
  'invalid order number formats should be rejected'
);

select throws_like(
  format(
    'update public.orders set order_number = %L where id = %L',
    '20260921214530-123456-00000123',
    :'generated_order_id'
  ),
  '%Order number is immutable%',
  'an assigned public order number should be immutable'
);

-- Reproduce the production migration condition: a row exists before the
-- canonical column is introduced and therefore starts with a NULL value.
alter table public.orders alter column order_number drop not null;
alter table public.orders disable trigger set_orders_order_number;
insert into public.orders (items, amount, order_number)
values ('[]'::jsonb, 0, null)
returning id \gset legacy_order_
alter table public.orders enable trigger set_orders_order_number;

select lives_ok(
  format(
    'update public.orders set order_number = public.format_order_number(created_at, id) where id = %L',
    :'legacy_order_id'
  ),
  'a historical row should accept its first backfilled order number'
);

select * from finish();

rollback;
