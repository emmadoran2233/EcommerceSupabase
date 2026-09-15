-- Foreign keys do not automatically create indexes in PostgreSQL. These indexes
-- protect parent-row updates/deletes from full child-table scans and support the
-- ownership queries used by RLS and seller workflows.

create index if not exists idx_email_events_seller_id
  on public.email_events (seller_id)
  where seller_id is not null;

create index if not exists idx_banner_created_by
  on public.banner (created_by)
  where created_by is not null;

create index if not exists idx_banner_updated_by
  on public.banner (updated_by)
  where updated_by is not null;

create index if not exists idx_orders_seller_created_at
  on public.orders (seller_id, created_at desc)
  where seller_id is not null;

create index if not exists idx_customizations_product_id
  on public.customizations (product_id);

create index if not exists idx_request_likes_user_id
  on public.request_likes (user_id);

create index if not exists idx_cart_items_cart_user
  on public.cart_items (cart_id, user_id);

