-- Enable RLS for public tables flagged by Supabase Security Advisor.
-- Policies are scoped to current browser usage; Edge Functions with service-role keys
-- continue to bypass RLS for internal email/order-event writes.

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.request_likes enable row level security;
alter table public.carts enable row level security;
alter table public.users enable row level security;
alter table public.reviews enable row level security;
alter table public.subscribers enable row level security;
alter table public.lend_items enable row level security;
alter table public.banner enable row level security;
alter table public.email_events enable row level security;
alter table public.products enable row level security;
alter table public.customizations enable row level security;
alter table public.orders enable row level security;

do $$
begin
  if to_regclass('public.order_email_events') is not null then
    execute 'alter table public.order_email_events enable row level security';
  end if;
end $$;

-- Grants define which operations reach RLS; policies below define which rows.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.requests from anon, authenticated;
revoke all on table public.request_likes from anon, authenticated;
revoke all on table public.carts from anon, authenticated;
revoke all on table public.users from anon, authenticated;
revoke all on table public.reviews from anon, authenticated;
revoke all on table public.subscribers from anon, authenticated;
revoke all on table public.lend_items from anon, authenticated;
revoke all on table public.banner from anon, authenticated;
revoke all on table public.email_events from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.customizations from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_email_events from anon, authenticated;

grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;
grant select, insert on table public.requests to anon, authenticated;
grant update on table public.requests to authenticated;
grant select, insert, delete on table public.request_likes to authenticated;
grant select, insert, update, delete on table public.carts to authenticated;
grant select, insert, update on table public.users to authenticated;
grant select on table public.reviews to anon, authenticated;
grant insert, update, delete on table public.reviews to authenticated;
grant insert on table public.subscribers to anon, authenticated;
grant select on table public.lend_items to anon, authenticated;
grant insert, update, delete on table public.lend_items to authenticated;
grant select on table public.banner to anon, authenticated;
grant insert, update, delete on table public.banner to authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.customizations to authenticated;
grant select, insert, update on table public.orders to authenticated;
grant usage, select on sequence public.lend_items_id_seq to authenticated;
grant usage, select on sequence public.reviews_id_seq to authenticated;
grant usage, select on sequence public.orders_id_seq to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.requests to service_role;
grant all on table public.request_likes to service_role;
grant all on table public.carts to service_role;
grant all on table public.users to service_role;
grant all on table public.reviews to service_role;
grant all on table public.subscribers to service_role;
grant all on table public.lend_items to service_role;
grant all on table public.banner to service_role;
grant all on table public.email_events to service_role;
grant all on table public.products to service_role;
grant all on table public.customizations to service_role;
grant all on table public.orders to service_role;
grant all on table public.order_email_events to service_role;
grant usage, select on sequence public.lend_items_id_seq to service_role;
grant usage, select on sequence public.reviews_id_seq to service_role;
grant usage, select on sequence public.orders_id_seq to service_role;

-- Repeat order policies here so a fresh environment remains reconstructable even
-- though the older order-only migration predates the baseline migration.
drop policy if exists "Buyers can view their own orders" on public.orders;
create policy "Buyers can view their own orders"
  on public.orders for select
  to authenticated
  using (
    (select auth.uid()) = buyer_id
    or (select auth.uid())::text = user_id
  );

drop policy if exists "Sellers can view orders containing their items" on public.orders;
create policy "Sellers can view orders containing their items"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end
      ) as item
      where item ->> 'seller_id' = (select auth.uid())::text
    )
  );

drop policy if exists "Buyers can create their own orders" on public.orders;
create policy "Buyers can create their own orders"
  on public.orders for insert
  to authenticated
  with check (
    (select auth.uid()) = buyer_id
    and (user_id is null or (select auth.uid())::text = user_id)
  );

drop policy if exists "Sellers can update orders containing their items" on public.orders;
create policy "Sellers can update orders containing their items"
  on public.orders for update
  to authenticated
  using (
    exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end
      ) as item
      where item ->> 'seller_id' = (select auth.uid())::text
    )
  )
  with check (
    exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end
      ) as item
      where item ->> 'seller_id' = (select auth.uid())::text
    )
  );

-- Store profiles are publicly visible, but only the profile owner can create or edit one.
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Public user rows are app metadata; each signed-in user can only access their own row.
drop policy if exists "Users can view their own public user row" on public.users;
create policy "Users can view their own public user row"
  on public.users for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users can insert their own public user row" on public.users;
create policy "Users can insert their own public user row"
  on public.users for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their own public user row" on public.users;
create policy "Users can update their own public user row"
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Cart data is private per signed-in user.
drop policy if exists "Users can view their own cart" on public.carts;
create policy "Users can view their own cart"
  on public.carts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own cart" on public.carts;
create policy "Users can insert their own cart"
  on public.carts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own cart" on public.carts;
create policy "Users can update their own cart"
  on public.carts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own cart" on public.carts;
create policy "Users can delete their own cart"
  on public.carts for delete
  to authenticated
  using (user_id = auth.uid());

-- Rental requests are public to browse. The current UI stores anonymous requests,
-- so inserts remain open while likes are tied to authenticated users.
drop policy if exists "Rental requests are public" on public.requests;
create policy "Rental requests are public"
  on public.requests for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can create rental requests" on public.requests;
create policy "Anyone can create rental requests"
  on public.requests for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Authenticated users can maintain request like counts" on public.requests;
create policy "Authenticated users can maintain request like counts"
  on public.requests for update
  to authenticated
  using (true)
  with check (true);

-- Likes are readable for UI state, but each signed-in user can only create/delete their own like.
drop policy if exists "Request likes are readable" on public.request_likes;
create policy "Request likes are readable"
  on public.request_likes for select
  to authenticated
  using (true);

drop policy if exists "Users can like requests as themselves" on public.request_likes;
create policy "Users can like requests as themselves"
  on public.request_likes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can remove their own request likes" on public.request_likes;
create policy "Users can remove their own request likes"
  on public.request_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- Reviews are public, but authors own write operations.
drop policy if exists "Reviews are public" on public.reviews;
create policy "Reviews are public"
  on public.reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can create their own reviews" on public.reviews;
create policy "Users can create their own reviews"
  on public.reviews for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own reviews" on public.reviews;
create policy "Users can update their own reviews"
  on public.reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Users can delete their own reviews"
  on public.reviews for delete
  to authenticated
  using (user_id = auth.uid());

-- Customizations are private to their authenticated owner.
drop policy if exists "Users can view their own customizations" on public.customizations;
create policy "Users can view their own customizations"
  on public.customizations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create their own customizations" on public.customizations;
create policy "Users can create their own customizations"
  on public.customizations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own customizations" on public.customizations;
create policy "Users can update their own customizations"
  on public.customizations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own customizations" on public.customizations;
create policy "Users can delete their own customizations"
  on public.customizations for delete
  to authenticated
  using (user_id = auth.uid());

-- Newsletter subscriptions only need public inserts from the storefront.
drop policy if exists "Anyone can subscribe to newsletter" on public.subscribers;
create policy "Anyone can subscribe to newsletter"
  on public.subscribers for insert
  to anon, authenticated
  with check (true);

-- Products must remain public to browse, while sellers manage only their own listings.
drop policy if exists "Products are public" on public.products;
create policy "Products are public"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "Sellers can create their own products" on public.products;
create policy "Sellers can create their own products"
  on public.products for insert
  to authenticated
  with check (seller_id = auth.uid());

drop policy if exists "Sellers can update their own products" on public.products;
create policy "Sellers can update their own products"
  on public.products for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "Sellers can delete their own products" on public.products;
create policy "Sellers can delete their own products"
  on public.products for delete
  to authenticated
  using (seller_id = auth.uid());

-- Lend items are public to browse; sellers manage only their own inventory.
drop policy if exists "Lend items are public" on public.lend_items;
create policy "Lend items are public"
  on public.lend_items for select
  to anon, authenticated
  using (true);

drop policy if exists "Sellers can create their own lend items" on public.lend_items;
create policy "Sellers can create their own lend items"
  on public.lend_items for insert
  to authenticated
  with check (seller_id = auth.uid());

drop policy if exists "Sellers can update their own lend items" on public.lend_items;
create policy "Sellers can update their own lend items"
  on public.lend_items for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "Sellers can delete their own lend items" on public.lend_items;
create policy "Sellers can delete their own lend items"
  on public.lend_items for delete
  to authenticated
  using (seller_id = auth.uid());

-- Banner is public to read. Writes are restricted to signed-in admin app users
-- until a dedicated admin role table is introduced.
drop policy if exists "Active banners are public" on public.banner;
create policy "Active banners are public"
  on public.banner for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can manage banners" on public.banner;
create policy "Authenticated users can manage banners"
  on public.banner for all
  to authenticated
  using (true)
  with check (true);
