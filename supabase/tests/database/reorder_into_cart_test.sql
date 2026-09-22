begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select has_function(
  'public',
  'reorder_into_cart',
  array['bigint'],
  'the atomic reorder function should exist'
);

select is_definer(
  'public',
  'reorder_into_cart',
  array['bigint'],
  'reorder should enforce ownership inside one privileged transaction'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.reorder_into_cart(bigint)',
    'EXECUTE'
  ),
  'authenticated users should be able to reorder'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.reorder_into_cart(bigint)',
    'EXECUTE'
  ),
  'anonymous callers should not reorder'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'reorder-buyer@example.test',
    '',
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '12000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'other-buyer@example.test',
    '',
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.products (id, name, price, rentable)
values
  ('32000000-0000-4000-8000-000000000003', 'Reorder shirt', 25, false),
  ('33000000-0000-4000-8000-000000000003', 'Reorder camera', 80, true);

insert into public.orders (
  items,
  buyer_id,
  user_id,
  order_id,
  amount
)
values (
  '[
    {
      "id":"32000000-0000-4000-8000-000000000003",
      "name":"Old shirt name",
      "quantity":2,
      "price":20,
      "size":"M",
      "customization":{"id":"custom-7","lines":["HELLO"]}
    },
    {
      "id":"33000000-0000-4000-8000-000000000003",
      "name":"Old camera name",
      "quantity":1,
      "rentInfo":{
        "startDate":"2026-10-01",
        "endDate":"2026-10-03",
        "rentFee":80,
        "deposit":100
      }
    }
  ]'::jsonb,
  '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'reorder-normalized-test',
  120
);

insert into public.order_items (
  order_id,
  line_number,
  product_id,
  item_type,
  product_name,
  quantity,
  unit_amount,
  line_amount,
  currency,
  size,
  customization,
  rental_start_date,
  rental_end_date,
  product_snapshot
)
values
  (
    (select id from public.orders where order_id = 'reorder-normalized-test'),
    1,
    '32000000-0000-4000-8000-000000000003',
    'purchase',
    'Reorder shirt',
    2,
    25,
    50,
    'usd',
    'M',
    '{"id":"custom-7","lines":["HELLO"]}'::jsonb,
    null,
    null,
    '{"images":["shirt.jpg"]}'::jsonb
  ),
  (
    (select id from public.orders where order_id = 'reorder-normalized-test'),
    2,
    '33000000-0000-4000-8000-000000000003',
    'rental',
    'Reorder camera',
    1,
    80,
    80,
    'usd',
    null,
    null,
    '2026-10-01',
    '2026-10-03',
    '{"rentInfo":{"deposit":100}}'::jsonb
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    public.reorder_into_cart(
      (select id from public.orders where order_id = 'reorder-normalized-test')
    ) ->> 'source'
  ),
  'order_items',
  'complete normalized lines should be the reorder source'
);

reset role;

select is(
  (
    select count(*) from public.carts
    where user_id = '11000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'reorder should create exactly one cart'
);

select is(
  (
    select count(*) from public.cart_items
    where user_id = '11000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'reorder should create normalized lines'
);

select is(
  (
    select quantity from public.cart_items
    where line_key = '32000000-0000-4000-8000-000000000003:M|custom:custom-7'
  ),
  2,
  'purchase quantity should be copied'
);

select is(
  (
    select customization #>> '{lines,0}' from public.cart_items
    where line_key = '32000000-0000-4000-8000-000000000003:M|custom:custom-7'
  ),
  'HELLO',
  'customization snapshot should be copied'
);

select is(
  (
    select rental_start_date::text from public.cart_items
    where line_key = '33000000-0000-4000-8000-000000000003:rent_2026-10-01_to_2026-10-03'
  ),
  '2026-10-01',
  'rental dates should be copied'
);

select is(
  (
    select jsonb_typeof(items) from public.carts
    where user_id = '11000000-0000-4000-8000-000000000001'
  ),
  'object',
  'the compatibility cart snapshot should use the current object shape'
);

set local role authenticated;

select is(
  (
    public.reorder_into_cart(
      (select id from public.orders where order_id = 'reorder-normalized-test')
    ) ->> 'added_line_count'
  ),
  '2',
  'a repeated reorder should process both lines'
);

reset role;

select is(
  (
    select quantity from public.cart_items
    where line_key = '32000000-0000-4000-8000-000000000003:M|custom:custom-7'
  ),
  4,
  'a repeated reorder should atomically add quantities'
);

select set_config(
  'test.reorder_order_id',
  (select id::text from public.orders where order_id = 'reorder-normalized-test'),
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_like(
  format(
    'select public.reorder_into_cart(%L::bigint)',
    current_setting('test.reorder_order_id')
  ),
  '%Order not found%',
  'a different buyer should not be able to reorder the order'
);

reset role;

insert into public.orders (items, buyer_id, user_id, order_id, amount)
values (
  '[{
    "id":"32000000-0000-4000-8000-000000000003",
    "name":"Historical shirt",
    "quantity":1,
    "size":"L"
  }]'::jsonb,
  '12000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
  'reorder-legacy-test',
  25
);

set local role authenticated;

select is(
  (
    public.reorder_into_cart(
      (select id from public.orders where order_id = 'reorder-legacy-test')
    ) ->> 'source'
  ),
  'orders.items',
  'an incomplete historical order should use its legacy snapshot'
);

reset role;

select is(
  (
    select quantity from public.cart_items
    where user_id = '12000000-0000-4000-8000-000000000001'
      and line_key = '32000000-0000-4000-8000-000000000003:L'
  ),
  1,
  'a valid historical line should still reach the normalized cart'
);

select is(
  (
    select items #>> '{32000000-0000-4000-8000-000000000003,L}'
    from public.carts
    where user_id = '12000000-0000-4000-8000-000000000001'
  ),
  '1',
  'the legacy fallback should also rebuild a readable cart snapshot'
);

select * from finish();

rollback;
