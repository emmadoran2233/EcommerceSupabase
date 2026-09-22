begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

select has_function(
  'public', 'reserve_seller_shippo_label', array['bigint', 'text'],
  'Shippo label purchases should have an atomic reservation function'
);
select has_function(
  'public', 'record_seller_shippo_label',
  array['bigint', 'uuid', 'text', 'text', 'text', 'text', 'numeric', 'text', 'text', 'text', 'text'],
  'Shippo labels should have a seller-scoped persistence function'
);
select has_function(
  'public', 'release_seller_shippo_reservation', array['bigint', 'uuid'],
  'explicit provider rejections should release a reservation'
);
select has_index(
  'public', 'seller_fulfillments',
  'seller_fulfillments_shipping_transaction_unique',
  'Shippo transaction ids should be unique across fulfillments'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.reserve_seller_shippo_label(bigint,text)', 'EXECUTE'
  ),
  'authenticated sellers should reserve their own label purchase'
);
select ok(
  not has_function_privilege(
    'anon', 'public.reserve_seller_shippo_label(bigint,text)', 'EXECUTE'
  ),
  'anonymous users should not reserve label purchases'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'shippo-buyer@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '42000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'shippo-seller-one@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '43000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'shippo-seller-two@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'shippo-unrelated@example.test', '', now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.products (id, name, price, seller_id)
values
  (
    '45000000-0000-4000-8000-000000000003', 'Shippo product one', 20,
    '42000000-0000-4000-8000-000000000002'
  ),
  (
    '46000000-0000-4000-8000-000000000003', 'Shippo product two', 30,
    '43000000-0000-4000-8000-000000000002'
  );

insert into public.orders (items, buyer_id, user_id, order_id, amount)
values (
  '[
    {"id":"45000000-0000-4000-8000-000000000003","seller_id":"42000000-0000-4000-8000-000000000002","name":"One","quantity":1,"price":20},
    {"id":"46000000-0000-4000-8000-000000000003","seller_id":"43000000-0000-4000-8000-000000000002","name":"Two","quantity":1,"price":30},
    {"seller_id":"44000000-0000-4000-8000-000000000002","name":"Untrusted legacy line","quantity":1,"price":1}
  ]'::jsonb,
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'secure-shippo-test', 50
);

insert into public.order_items (
  order_id, line_number, product_id, seller_id, item_type, product_name,
  quantity, unit_amount, line_amount, currency, product_snapshot
)
values
  (
    (select id from public.orders where order_id = 'secure-shippo-test'), 1,
    '45000000-0000-4000-8000-000000000003',
    '42000000-0000-4000-8000-000000000002', 'purchase', 'One',
    1, 20, 20, 'usd', '{}'::jsonb
  ),
  (
    (select id from public.orders where order_id = 'secure-shippo-test'), 2,
    '46000000-0000-4000-8000-000000000003',
    '43000000-0000-4000-8000-000000000002', 'purchase', 'Two',
    1, 30, 30, 'usd', '{}'::jsonb
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select set_config(
  'test.shippo_purchase_token',
  public.reserve_seller_shippo_label(
    (select id from public.orders where order_id = 'secure-shippo-test'),
    'rate-one'
  )::text,
  true
);

reset role;

select ok(
  current_setting('test.shippo_purchase_token')::uuid is not null,
  'a seller should receive an opaque purchase reservation token'
);
select is(
  (
    select shipping_purchase_token
    from public.seller_fulfillments
    where seller_id = '42000000-0000-4000-8000-000000000002'
  ),
  current_setting('test.shippo_purchase_token')::uuid,
  'the reservation should be stored only on the current seller fulfillment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_like(
  format(
    'select public.reserve_seller_shippo_label(%L::bigint, %L)',
    (select id from public.orders where order_id = 'secure-shippo-test'),
    'rate-one'
  ),
  '%Label purchase already in progress%',
  'a concurrent label purchase should be rejected'
);

select is(
  (
    public.record_seller_shippo_label(
      (select id from public.orders where order_id = 'secure-shippo-test'),
      current_setting('test.shippo_purchase_token')::uuid,
      'rate-one', 'transaction-one', 'USPS', 'Priority Mail', 8.25, 'usd',
      'https://labels.example/one.pdf', 'TRACK-ONE',
      'https://tracking.example/one'
    ) ->> 'order_status'
  ),
  'Shipped',
  'recording one seller label should derive the compatibility order status'
);

reset role;

select is(
  (
    select shipping_transaction_id
    from public.seller_fulfillments
    where seller_id = '42000000-0000-4000-8000-000000000002'
  ),
  'transaction-one',
  'the Shippo transaction should be stored on the current seller fulfillment'
);
select is(
  (
    select shipping_carrier
    from public.seller_fulfillments
    where seller_id = '42000000-0000-4000-8000-000000000002'
  ),
  'USPS',
  'provider-returned carrier metadata should be stored'
);
select is(
  (
    select status
    from public.seller_fulfillments
    where seller_id = '43000000-0000-4000-8000-000000000002'
  ),
  'pending',
  'another seller fulfillment should remain pending'
);
select is(
  (
    select shipping_tracking_number
    from public.orders
    where order_id = 'secure-shippo-test'
  ),
  null,
  'multi-seller tracking should not be collapsed onto the shared order header'
);

select set_config(
  'test.shippo_order_id',
  (select id::text from public.orders where order_id = 'secure-shippo-test'),
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"44000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_like(
  format(
    'select public.reserve_seller_shippo_label(%L::bigint, %L)',
    current_setting('test.shippo_order_id'),
    'fake-rate'
  ),
  '%Order not found%',
  'a seller found only in legacy JSON should not purchase a label'
);

select * from finish();

rollback;
