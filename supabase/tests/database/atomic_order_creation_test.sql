begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

select has_column(
  'public',
  'orders',
  'checkout_request_id',
  'orders should carry an idempotent checkout request id'
);

select has_function(
  'public',
  'create_order_with_items',
  array['jsonb'],
  'the atomic order aggregate function should exist'
);

select is_definer(
  'public',
  'create_order_with_items',
  array['jsonb'],
  'order creation should enforce trusted identity inside one transaction'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_order_with_items(jsonb)',
    'EXECUTE'
  ),
  'authenticated users should be able to create orders'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_order_with_items(jsonb)',
    'EXECUTE'
  ),
  'anonymous callers should not create persisted orders'
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
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'order-buyer@example.test',
    '',
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'seller-one@example.test',
    '',
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-8000-000000000000',
    '21000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'seller-two@example.test',
    '',
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.user_roles (user_id, role, source)
values
  ('20000000-0000-4000-8000-000000000002', 'seller', 'manual_admin'),
  ('21000000-0000-4000-8000-000000000002', 'seller', 'manual_admin');

insert into public.seller_accounts (user_id, status, activation_source)
values
  ('20000000-0000-4000-8000-000000000002', 'active', 'platform_admin'),
  ('21000000-0000-4000-8000-000000000002', 'active', 'platform_admin');

insert into public.products (id, name, price, seller_id, rentable)
values
  (
    '30000000-0000-4000-8000-000000000003',
    'Custom shirt',
    25,
    '20000000-0000-4000-8000-000000000002',
    false
  ),
  (
    '31000000-0000-4000-8000-000000000003',
    'Rental camera',
    100,
    '21000000-0000-4000-8000-000000000002',
    true
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

set local role authenticated;

select lives_ok(
  $test$
    select public.create_order_with_items(
      '{
        "checkout_request_id":"40000000-0000-4000-8000-000000000004",
        "address":{"city":"Chicago"},
        "paymentmethod":"cod",
        "amount":160,
        "charge_currency":"usd",
        "buyer_id":"ffffffff-ffff-4fff-8fff-ffffffffffff",
        "payment":true,
        "status":"Delivered",
        "items":[
          {
            "id":"30000000-0000-4000-8000-000000000003",
            "seller_id":"21000000-0000-4000-8000-000000000002",
            "name":"Custom shirt",
            "price":25,
            "quantity":2,
            "size":"M",
            "customization":{"id":"custom-1","lines":["HELLO"]}
          },
          {
            "id":"31000000-0000-4000-8000-000000000003",
            "seller_id":"20000000-0000-4000-8000-000000000002",
            "name":"Rental camera",
            "quantity":1,
            "rentInfo":{
              "startDate":"2026-09-15",
              "endDate":"2026-09-17",
              "totalPrice":100
            }
          }
        ]
      }'::jsonb
    )
  $test$,
  'one call should create the complete order aggregate'
);

reset role;

select is(
  (
    select buyer_id
    from public.orders
    where checkout_request_id = '40000000-0000-4000-8000-000000000004'
  ),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'the authenticated identity should override client buyer identity'
);

select is(
  (
    select payment
    from public.orders
    where checkout_request_id = '40000000-0000-4000-8000-000000000004'
  ),
  false,
  'clients should not mark a new order as paid'
);

select is(
  (
    select status
    from public.orders
    where checkout_request_id = '40000000-0000-4000-8000-000000000004'
  ),
  'Order Placed',
  'clients should not choose a privileged order status'
);

select is(
  (
    select count(*)
    from public.order_items
    where order_id = (
      select id from public.orders
      where checkout_request_id = '40000000-0000-4000-8000-000000000004'
    )
  ),
  2::bigint,
  'both immutable order lines should be created'
);

select is(
  (
    select customization #>> '{lines,0}'
    from public.order_items
    where product_id = '30000000-0000-4000-8000-000000000003'
  ),
  'HELLO',
  'the cart customization should become an order-line snapshot'
);

select is(
  (
    select rental_start_date
    from public.order_items
    where product_id = '31000000-0000-4000-8000-000000000003'
  ),
  '2026-09-15'::date,
  'rental dates should be stored in relational columns'
);

select is(
  (
    select seller_id
    from public.order_items
    where product_id = '30000000-0000-4000-8000-000000000003'
  ),
  '20000000-0000-4000-8000-000000000002'::uuid,
  'seller ownership should come from the catalog instead of client JSON'
);

select is(
  (
    select count(*)
    from public.seller_fulfillments
    where order_id = (
      select id from public.orders
      where checkout_request_id = '40000000-0000-4000-8000-000000000004'
    )
  ),
  2::bigint,
  'multi-seller orders should receive one fulfillment per seller'
);

set local role authenticated;

select is(
  public.create_order_with_items(
    '{
      "checkout_request_id":"40000000-0000-4000-8000-000000000004",
      "address":{"city":"Chicago"},
      "paymentmethod":"cod",
      "amount":160,
      "items":[{"id":"30000000-0000-4000-8000-000000000003","price":25,"quantity":2}]
    }'::jsonb
  ),
  (
    select id from public.orders
    where checkout_request_id = '40000000-0000-4000-8000-000000000004'
  ),
  'retrying the same checkout request should return the existing order'
);

select throws_ok(
  $test$
    select public.create_order_with_items(
      '{
        "checkout_request_id":"41000000-0000-4000-8000-000000000004",
        "address":{"city":"Chicago"},
        "paymentmethod":"cod",
        "amount":50,
        "items":[
          {"id":"30000000-0000-4000-8000-000000000003","price":25,"quantity":1},
          {"id":"31000000-0000-4000-8000-000000000003","price":"invalid","quantity":1}
        ]
      }'::jsonb
    )
  $test$,
  '22023',
  'Order line 2 has an invalid amount',
  'an invalid line should abort the entire aggregate'
);

reset role;

select is(
  (
    select count(*)
    from public.orders
    where checkout_request_id = '40000000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  'an idempotent retry should not create a duplicate order'
);

select is(
  (
    select count(*)
    from public.orders
    where checkout_request_id = '41000000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'a failed aggregate should not leave an orphan order header'
);

select * from finish();

rollback;
