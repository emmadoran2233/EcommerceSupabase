begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

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
    'buyer@example.test',
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
    'seller@example.test',
    '',
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.products (id, name, price, seller_id)
values (
  '30000000-0000-4000-8000-000000000003',
  'Test product',
  25,
  '20000000-0000-4000-8000-000000000002'
);

-- Reproduce the audited legacy condition: the public row has the right unique
-- email but an id that does not belong to Auth. Constraint triggers are disabled
-- only for this fixture, then restored before the backfill is exercised.
delete from public.users
where id = '10000000-0000-4000-8000-000000000001';

set local session_replication_role = replica;
insert into public.users (id, email, "cartData")
values (
  '50000000-0000-4000-8000-000000000005',
  'buyer@example.test',
  '{"preserved":true}'::jsonb
);
set local session_replication_role = origin;

insert into public.orders (id, user_id, items, amount)
overriding system value
values (
  900001,
  '10000000-0000-4000-8000-000000000001',
  '[{"id":"30000000-0000-4000-8000-000000000003","seller_id":"20000000-0000-4000-8000-000000000002","name":"Test product","price":25,"quantity":2,"size":"M"}]'::jsonb,
  50
);

insert into public.carts (id, user_id, items)
values (
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  '{"30000000-0000-4000-8000-000000000003":{"M":2}}'::jsonb
);

select public.backfill_relational_data();
select public.backfill_relational_data();

select is(
  (select buyer_id from public.orders where id = 900001),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'exact legacy order identity is backfilled'
);

select is(
  (
    select count(*)
    from public.users
    where id = '10000000-0000-4000-8000-000000000001'
      and "cartData" = '{"preserved":true}'::jsonb
  ),
  1::bigint,
  'a unique email match repairs the legacy public user id without losing data'
);

select is((select count(*) from public.order_items where order_id = 900001), 1::bigint, 'order backfill is idempotent');
select is((select quantity from public.order_items where order_id = 900001), 2, 'order quantity is preserved');
select is((select line_amount from public.order_items where order_id = 900001), 50.00::numeric, 'order line amount is derived');
select is((select seller_id from public.order_items where order_id = 900001), '20000000-0000-4000-8000-000000000002'::uuid, 'seller identity is linked');
select is((select count(*) from public.seller_fulfillments where order_id = 900001), 1::bigint, 'single-seller fulfillment is created once');
select is((select count(*) from public.cart_items where cart_id = '40000000-0000-4000-8000-000000000004'), 1::bigint, 'cart backfill is idempotent');
select is((select quantity from public.cart_items where cart_id = '40000000-0000-4000-8000-000000000004'), 2, 'cart quantity is preserved');
select ok(exists(select 1 from public.user_roles where user_id = '20000000-0000-4000-8000-000000000002' and role = 'seller'), 'inventory owner receives seller role');
select ok(exists(select 1 from public.seller_accounts where user_id = '20000000-0000-4000-8000-000000000002' and status = 'active'), 'inventory owner remains active');

select * from finish();

rollback;
