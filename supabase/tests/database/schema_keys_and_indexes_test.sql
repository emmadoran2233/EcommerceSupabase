begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_pk('public', table_name, format('%s has a primary key', table_name))
from unnest(array[
  'admin_audit_logs',
  'banner',
  'cart_items',
  'carts',
  'customizations',
  'email_events',
  'lend_items',
  'order_email_events',
  'order_items',
  'order_payments',
  'orders',
  'products',
  'profiles',
  'request_likes',
  'requests',
  'reviews',
  'seller_accounts',
  'seller_fulfillments',
  'subscribers',
  'user_roles',
  'users'
]) as table_name;

select has_index('public', 'email_events', 'idx_email_events_seller_id', 'email seller foreign key is indexed');
select has_index('public', 'banner', 'idx_banner_created_by', 'banner creator foreign key is indexed');
select has_index('public', 'banner', 'idx_banner_updated_by', 'banner updater foreign key is indexed');
select has_index('public', 'orders', 'idx_orders_seller_created_at', 'order seller foreign key is indexed');
select has_index('public', 'customizations', 'idx_customizations_product_id', 'customization product foreign key is indexed');
select has_index('public', 'request_likes', 'idx_request_likes_user_id', 'request-like user foreign key is indexed');
select has_index('public', 'cart_items', 'idx_cart_items_cart_user', 'cart ownership foreign key is indexed');

select * from finish();

rollback;
