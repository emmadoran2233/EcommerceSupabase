begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

select has_table('public', 'order_items', 'order_items should exist');
select has_table('public', 'seller_fulfillments', 'seller_fulfillments should exist');
select has_table('public', 'order_payments', 'order_payments should exist');
select has_table('public', 'cart_items', 'cart_items should exist');

select ok(
  (select count(*) = 1 from pg_constraint
   where conrelid = 'public.order_items'::regclass and contype = 'p'),
  'order_items should have a primary key'
);
select ok(
  (select count(*) = 1 from pg_constraint
   where conrelid = 'public.seller_fulfillments'::regclass and contype = 'p'),
  'seller_fulfillments should have a primary key'
);
select ok(
  (select count(*) = 1 from pg_constraint
   where conrelid = 'public.order_payments'::regclass and contype = 'p'),
  'order_payments should have a primary key'
);
select ok(
  (select count(*) = 1 from pg_constraint
   where conrelid = 'public.cart_items'::regclass and contype = 'p'),
  'cart_items should have a primary key'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_items'::regclass),
  'RLS should be enabled on order_items'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.seller_fulfillments'::regclass),
  'RLS should be enabled on seller_fulfillments'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_payments'::regclass),
  'RLS should be enabled on order_payments'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.cart_items'::regclass),
  'RLS should be enabled on cart_items'
);

select ok(
  (select count(*) = 3 from pg_constraint
   where conrelid = 'public.order_items'::regclass and contype = 'f'),
  'order_items should reference orders, products, and seller identities'
);
select ok(
  (select count(*) = 2 from pg_constraint
   where conrelid = 'public.seller_fulfillments'::regclass and contype = 'f'),
  'seller_fulfillments should reference orders and seller identities'
);
select ok(
  (select count(*) = 1 from pg_constraint
   where conrelid = 'public.order_payments'::regclass and contype = 'f'),
  'order_payments should reference orders'
);
select ok(
  (select count(*) = 2 from pg_constraint
   where conrelid = 'public.cart_items'::regclass and contype = 'f'),
  'cart_items should reference carts and products'
);

select * from finish();
rollback;

