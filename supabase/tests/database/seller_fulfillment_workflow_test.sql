begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

select has_function(
  'public',
  'update_seller_fulfillment',
  array['bigint', 'text', 'text', 'text'],
  'the seller fulfillment mutation function should exist'
);

select is_definer(
  'public',
  'update_seller_fulfillment',
  array['bigint', 'text', 'text', 'text'],
  'the seller mutation should enforce ownership inside one transaction'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.update_seller_fulfillment(bigint,text,text,text)',
    'EXECUTE'
  ),
  'authenticated sellers should be able to update their fulfillment'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.update_seller_fulfillment(bigint,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users should not update fulfillments'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Sellers can update orders containing their items'
  ),
  'sellers should no longer update the shared order header directly'
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
    '15000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'fulfillment-buyer@example.test',
    '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '26000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'fulfillment-seller-one@example.test',
    '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '27000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'fulfillment-seller-two@example.test',
    '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '28000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'unrelated-seller@example.test',
    '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.products (id, name, price, seller_id)
values
  (
    '35000000-0000-4000-8000-000000000003',
    'Seller one product',
    25,
    '26000000-0000-4000-8000-000000000002'
  ),
  (
    '36000000-0000-4000-8000-000000000003',
    'Seller two product',
    30,
    '27000000-0000-4000-8000-000000000002'
  );

insert into public.orders (items, buyer_id, user_id, order_id, amount)
values (
  '[
    {
      "id":"35000000-0000-4000-8000-000000000003",
      "seller_id":"26000000-0000-4000-8000-000000000002",
      "name":"Seller one product","quantity":1,"price":25
    },
    {
      "id":"36000000-0000-4000-8000-000000000003",
      "seller_id":"27000000-0000-4000-8000-000000000002",
      "name":"Seller two product","quantity":1,"price":30
    }
  ]'::jsonb,
  '15000000-0000-4000-8000-000000000001',
  '15000000-0000-4000-8000-000000000001',
  'fulfillment-workflow-test',
  55
);

insert into public.order_items (
  order_id,
  line_number,
  product_id,
  seller_id,
  item_type,
  product_name,
  quantity,
  unit_amount,
  line_amount,
  currency,
  product_snapshot
)
values
  (
    (select id from public.orders where order_id = 'fulfillment-workflow-test'),
    1,
    '35000000-0000-4000-8000-000000000003',
    '26000000-0000-4000-8000-000000000002',
    'purchase', 'Seller one product', 1, 25, 25, 'usd', '{}'::jsonb
  ),
  (
    (select id from public.orders where order_id = 'fulfillment-workflow-test'),
    2,
    '36000000-0000-4000-8000-000000000003',
    '27000000-0000-4000-8000-000000000002',
    'purchase', 'Seller two product', 1, 30, 30, 'usd', '{}'::jsonb
  );

-- Simulate a historical partial backfill: only one of the two seller
-- fulfillments exists before the first update.
insert into public.seller_fulfillments (order_id, seller_id)
select
  orders.id,
  '26000000-0000-4000-8000-000000000002'::uuid
from public.orders
where orders.order_id = 'fulfillment-workflow-test';

select set_config(
  'request.jwt.claims',
  '{"sub":"26000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    public.update_seller_fulfillment(
      (select id from public.orders where order_id = 'fulfillment-workflow-test'),
      'shipped',
      'TRACK-ONE',
      'https://tracking.example/one'
    ) ->> 'order_status'
  ),
  'Shipped',
  'one shipped seller should advance the aggregate order status'
);

reset role;

select is(
  (
    select status from public.seller_fulfillments
    where seller_id = '26000000-0000-4000-8000-000000000002'
  ),
  'shipped',
  'only the current seller fulfillment status should change'
);

select is(
  (
    select tracking_number from public.seller_fulfillments
    where seller_id = '26000000-0000-4000-8000-000000000002'
  ),
  'TRACK-ONE',
  'manual tracking should be stored on the seller fulfillment'
);

select is(
  (
    select status from public.seller_fulfillments
    where seller_id = '27000000-0000-4000-8000-000000000002'
  ),
  'pending',
  'a missing seller fulfillment should be materialized as pending'
);

select is(
  (
    select status from public.orders
    where order_id = 'fulfillment-workflow-test'
  ),
  'Shipped',
  'the compatibility order status should be derived from fulfillments'
);

select is(
  (
    select shipping_tracking_number from public.orders
    where order_id = 'fulfillment-workflow-test'
  ),
  null,
  'multi-seller tracking should not be collapsed onto the order header'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"27000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    public.update_seller_fulfillment(
      (select id from public.orders where order_id = 'fulfillment-workflow-test'),
      'out_for_delivery',
      'TRACK-TWO',
      null
    ) ->> 'order_status'
  ),
  'Out for delivery',
  'out-for-delivery should be represented independently per seller'
);

reset role;

select is(
  (
    select tracking_number from public.seller_fulfillments
    where seller_id = '27000000-0000-4000-8000-000000000002'
  ),
  'TRACK-TWO',
  'the second seller tracking number should remain on its own fulfillment'
);

select set_config(
  'test.fulfillment_order_id',
  (select id::text from public.orders where order_id = 'fulfillment-workflow-test'),
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"28000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_like(
  format(
    'select public.update_seller_fulfillment(%L::bigint, %L, null, null)',
    current_setting('test.fulfillment_order_id'),
    'packing'
  ),
  '%Order not found%',
  'an unrelated seller should not update a fulfillment'
);

select throws_like(
  format(
    'select public.update_seller_fulfillment(%L::bigint, %L, null, null)',
    current_setting('test.fulfillment_order_id'),
    'invalid-status'
  ),
  '%Unsupported fulfillment status%',
  'unsupported fulfillment statuses should be rejected'
);

select * from finish();

rollback;
