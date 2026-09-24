begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select has_function(
  'public',
  'seller_can_access_order',
  array['bigint', 'uuid'],
  'normalized seller order authorization should exist'
);

select is_definer(
  'public',
  'seller_can_access_order',
  array['bigint', 'uuid'],
  'seller authorization should avoid recursive RLS evaluation'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.seller_can_access_order(bigint,uuid)',
    'EXECUTE'
  ),
  'authenticated sellers should be able to evaluate the policy helper'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.seller_can_access_order(bigint,uuid)',
    'EXECUTE'
  ),
  'anonymous users should not execute the policy helper'
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
    '14000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'policy-buyer@example.test',
    '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '24000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'policy-seller@example.test',
    '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '25000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'other-seller@example.test',
    '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.products (id, name, price, seller_id)
values (
  '34000000-0000-4000-8000-000000000003',
  'Policy product',
  25,
  '24000000-0000-4000-8000-000000000002'
);

insert into public.orders (items, buyer_id, user_id, order_id, amount)
values
  (
    '[{
      "id":"34000000-0000-4000-8000-000000000003",
      "seller_id":"25000000-0000-4000-8000-000000000002",
      "name":"Untrusted legacy seller",
      "quantity":1,
      "price":25
    }]'::jsonb,
    '14000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000001',
    'policy-normalized-order',
    25
  ),
  (
    '[{
      "id":"34000000-0000-4000-8000-000000000003",
      "seller_id":"24000000-0000-4000-8000-000000000002",
      "name":"Historical product",
      "quantity":1,
      "price":25
    }]'::jsonb,
    '14000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000001',
    'policy-historical-order',
    25
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
values (
  (select id from public.orders where order_id = 'policy-normalized-order'),
  1,
  '34000000-0000-4000-8000-000000000003',
  '24000000-0000-4000-8000-000000000002',
  'purchase',
  'Policy product',
  1,
  25,
  25,
  'usd',
  '{}'::jsonb
);

select ok(
  public.seller_can_access_order(
    (select id from public.orders where order_id = 'policy-normalized-order'),
    '24000000-0000-4000-8000-000000000002'
  ),
  'the catalog-derived normalized seller should have access'
);

select ok(
  not public.seller_can_access_order(
    (select id from public.orders where order_id = 'policy-normalized-order'),
    '25000000-0000-4000-8000-000000000002'
  ),
  'complete normalized lines should override an untrusted legacy seller id'
);

select ok(
  public.seller_can_access_order(
    (select id from public.orders where order_id = 'policy-historical-order'),
    '24000000-0000-4000-8000-000000000002'
  ),
  'historical orders without normalized lines should retain seller access'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"24000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*) from public.orders
    where order_id like 'policy-%'
  ),
  2::bigint,
  'the seller RLS policy should expose normalized and historical owned orders'
);

select lives_ok(
  $test$
    update public.orders
    set status = 'Packing'
    where order_id = 'policy-normalized-order'
  $test$,
  'the normalized seller should retain the existing update capability'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"25000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*) from public.orders
    where order_id like 'policy-%'
  ),
  0::bigint,
  'a seller named only by stale JSON should not see a complete normalized order'
);

select * from finish();

rollback;
