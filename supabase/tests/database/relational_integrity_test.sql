begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select has_column('public', 'requests', 'requester_id', 'requests should identify their creator');
select has_column('public', 'banner', 'created_by', 'banners should track their creator');
select has_column('public', 'banner', 'updated_by', 'banners should track their last editor');
select has_column('public', 'customizations', 'user_id', 'customizations should identify their user');
select has_column('public', 'reviews', 'product_uuid', 'reviews should have a canonical product UUID');
select has_column('public', 'orders', 'shipping_transaction_id', 'orders should retain the Shippo transaction reference');

select ok(
  exists (select 1 from pg_constraint where conname = 'reviews_product_uuid_fkey'),
  'reviews.product_uuid should have a foreign key'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'request_likes_user_id_fkey'),
  'request_likes.user_id should have a foreign key'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'order_email_events_recipient_user_id_fkey'),
  'order email recipients should have a foreign key'
);

select has_index('public', 'carts', 'idx_carts_id_unique', 'cart UUIDs should be unique');
select has_index('public', 'orders', 'idx_orders_buyer_created_at', 'buyer order history should be indexed');
select has_index('public', 'orders', 'idx_orders_status_created_at', 'order operations should be indexed');
select has_index('public', 'request_likes', 'idx_request_likes_request_user', 'request likes should be indexed');

select * from finish();
rollback;
