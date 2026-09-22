begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'fulfillment-buyer@example.test', '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '82000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'fulfillment-seller-one@example.test', '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '83000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'fulfillment-seller-two@example.test', '',
    now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.products (id, name, price, seller_id)
values
  (
    '84000000-0000-4000-8000-000000000004', 'Seller one product', 10,
    '82000000-0000-4000-8000-000000000002'
  ),
  (
    '85000000-0000-4000-8000-000000000005', 'Seller two product', 20,
    '83000000-0000-4000-8000-000000000003'
  );

insert into public.orders (
  id, buyer_id, user_id, items, amount, shipping_tracking_number,
  shipping_tracking_url
)
overriding system value
values (
  980001,
  '81000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '[]'::jsonb,
  30,
  'AMBIGUOUS-SHARED-TRACKING',
  'https://tracking.example/ambiguous'
);

insert into public.order_items (
  order_id, line_number, product_id, seller_id, product_name, quantity,
  unit_amount, line_amount
)
values
  (
    980001, 1, '84000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000002', 'Seller one product', 1, 10, 10
  ),
  (
    980001, 2, '85000000-0000-4000-8000-000000000005',
    '83000000-0000-4000-8000-000000000003', 'Seller two product', 1, 20, 20
  );

select is(
  public.backfill_missing_seller_fulfillments(),
  2::bigint,
  'the first run creates one fulfillment for each seller'
);
select is(
  public.backfill_missing_seller_fulfillments(),
  0::bigint,
  'the fulfillment backfill is idempotent'
);
select is(
  (select count(*) from public.seller_fulfillments where order_id = 980001),
  2::bigint,
  'a multi-seller order has two fulfillment aggregates'
);
select is(
  (select count(distinct seller_id) from public.seller_fulfillments where order_id = 980001),
  2::bigint,
  'the fulfillment aggregates preserve seller ownership'
);
select is(
  (select count(*) from public.seller_fulfillments where order_id = 980001 and status = 'pending'),
  2::bigint,
  'new historical fulfillments start pending'
);
select is(
  (
    select count(*)
    from public.seller_fulfillments
    where order_id = 980001
      and (tracking_number is not null or tracking_url is not null)
  ),
  0::bigint,
  'ambiguous shared tracking is not copied to either seller'
);

select * from finish();

rollback;
