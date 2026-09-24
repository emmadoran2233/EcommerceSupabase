begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select has_column(
  'public',
  'cart_items',
  'rental_quote',
  'cart items should preserve the temporary rental display quote'
);

select has_function(
  'public',
  'set_cart_line',
  array['uuid', 'text', 'integer', 'text', 'jsonb', 'date', 'date', 'jsonb', 'jsonb'],
  'the atomic cart-line mutation function should exist'
);

select is_definer(
  'public',
  'set_cart_line',
  array['uuid', 'text', 'integer', 'text', 'jsonb', 'date', 'date', 'jsonb', 'jsonb'],
  'cart mutations should validate identity inside one privileged transaction'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.set_cart_line(uuid,text,integer,text,jsonb,date,date,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated users should be able to mutate their cart'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.set_cart_line(uuid,text,integer,text,jsonb,date,date,jsonb,jsonb)',
    'EXECUTE'
  ),
  'anonymous callers should not mutate persisted carts'
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
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'cart-buyer@example.test',
  '',
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.products (id, name, price)
values ('30000000-0000-4000-8000-000000000003', 'Cart product', 100);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

set local role authenticated;

select lives_ok(
  $test$
    select public.set_cart_line(
      '30000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000003:rent_2026-09-15_to_2026-09-17',
      1,
      null,
      null,
      '2026-09-15',
      '2026-09-17',
      '{"days":3,"rentFee":60,"deposit":40,"totalPrice":100}',
      '{"30000000-0000-4000-8000-000000000003":{"rent_2026-09-15_to_2026-09-17":{"quantity":1}}}'
    )
  $test$,
  'an authenticated user should atomically create a cart line'
);

reset role;

select is(
  (
    select count(*)
    from public.carts
    where user_id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'the mutation should create exactly one cart for the user'
);

select is(
  (
    select quantity
    from public.cart_items
    where user_id = '10000000-0000-4000-8000-000000000001'
  ),
  1,
  'the normalized cart line should preserve quantity'
);

select is(
  (
    select rental_quote ->> 'totalPrice'
    from public.cart_items
    where user_id = '10000000-0000-4000-8000-000000000001'
  ),
  '100',
  'the normalized line should preserve the rental display quote'
);

set local role authenticated;

select lives_ok(
  $test$
    select public.set_cart_line(
      '30000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000003:rent_2026-09-15_to_2026-09-17',
      0,
      null,
      null,
      null,
      null,
      null,
      '{}'
    )
  $test$,
  'setting quantity to zero should delete the normalized line'
);

reset role;

select is(
  (
    select count(*)
    from public.cart_items
    where user_id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'deleted lines should not remain as zero-quantity rows'
);

select * from finish();

rollback;
