begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select has_function(
  'public', 'set_normalized_cart_line',
  array['uuid', 'text', 'integer', 'text', 'jsonb', 'date', 'date', 'jsonb'],
  'the normalized-only cart mutation contract should exist'
);
select is_definer(
  'public', 'set_normalized_cart_line',
  array['uuid', 'text', 'integer', 'text', 'jsonb', 'date', 'date', 'jsonb'],
  'the normalized cart mutation should enforce identity transactionally'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.set_normalized_cart_line(uuid,text,integer,text,jsonb,date,date,jsonb)',
    'EXECUTE'
  ),
  'authenticated users should be able to use the normalized contract'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.set_normalized_cart_line(uuid,text,integer,text,jsonb,date,date,jsonb)',
    'EXECUTE'
  ),
  'anonymous users should not mutate carts'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'normalized-cart@example.test', '',
  now(), now(), '{}'::jsonb, '{}'::jsonb
);

insert into public.products (id, name, price)
values ('92000000-0000-4000-8000-000000000002', 'Normalized cart product', 25);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $test$
    select public.set_normalized_cart_line(
      '92000000-0000-4000-8000-000000000002',
      '92000000-0000-4000-8000-000000000002:M',
      2, 'M', null, null, null, null
    )
  $test$,
  'the normalized contract should create a cart line'
);

reset role;

select is(
  (
    select items from public.carts
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  '{}'::jsonb,
  'the normalized contract should not write legacy cart JSON'
);
select is(
  (
    select quantity from public.cart_items
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  2,
  'the normalized line should retain its quantity'
);

set local role authenticated;
select lives_ok(
  $test$
    select public.set_normalized_cart_line(
      '92000000-0000-4000-8000-000000000002',
      '92000000-0000-4000-8000-000000000002:M',
      0, 'M', null, null, null, null
    )
  $test$,
  'zero quantity should remove the normalized line'
);
reset role;

select * from finish();

rollback;
