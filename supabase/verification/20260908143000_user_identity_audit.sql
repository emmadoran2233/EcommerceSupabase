-- Read-only checks to run before and after the identity migration.
-- These queries return counts only; they do not expose user emails or modify data.

select 'auth_users' as check_name, count(*) as affected_rows
from auth.users
union all
select 'public_users_without_auth_identity', count(*)
from public.users as app_user
where not exists (
  select 1 from auth.users as auth_user where auth_user.id = app_user.id
)
union all
select 'auth_users_without_public_user_row', count(*)
from auth.users as auth_user
where not exists (
  select 1 from public.users as app_user where app_user.id = auth_user.id
)
union all
select 'auth_users_without_profile', count(*)
from auth.users as auth_user
where not exists (
  select 1 from public.profiles as profile where profile.id = auth_user.id
)
union all
select 'public_user_email_matches_wrong_auth_id', count(*)
from public.users as app_user
join auth.users as auth_user
  on lower(auth_user.email) = lower(app_user.email)
where auth_user.id <> app_user.id
union all
select 'orders_without_buyer_id', count(*)
from public.orders
where buyer_id is null
union all
select 'orders_with_unmatched_legacy_user_id', count(*)
from public.orders as orders
where orders.user_id is not null
  and not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id::text = orders.user_id
  )
union all
select 'orders_missing_buyer_with_exact_auth_match', count(*)
from public.orders as orders
where orders.buyer_id is null
  and exists (
    select 1 from auth.users as auth_user
    where auth_user.id::text = orders.user_id
  )
union all
select 'orders_missing_all_buyer_identifiers', count(*)
from public.orders
where buyer_id is null
  and nullif(trim(user_id), '') is null
union all
select 'orphan_public_users_with_one_auth_email_match', count(*)
from public.users as app_user
where not exists (
    select 1 from auth.users as auth_user where auth_user.id = app_user.id
  )
  and 1 = (
    select count(*)
    from auth.users as auth_user
    where lower(auth_user.email) = lower(app_user.email)
  )
union all
select 'products_without_seller_id', count(*)
from public.products
where seller_id is null
union all
select 'lend_items_without_seller_id', count(*)
from public.lend_items
where seller_id is null
union all
select 'reviews_without_user_id', count(*)
from public.reviews
where user_id is null
union all
select 'reviews_without_matching_product', count(*)
from public.reviews as review
where not exists (
  select 1
  from public.products as product
  where product.id::text = review.product_id
)
union all
select 'duplicate_request_like_pairs', count(*)
from (
  select request_id, user_id
  from public.request_likes
  group by request_id, user_id
  having count(*) > 1
) as duplicate_likes
union all
select 'duplicate_cart_ids', count(*)
from (
  select id
  from public.carts
  group by id
  having count(*) > 1
) as duplicate_carts
union all
select 'case_insensitive_duplicate_subscriber_emails', count(*)
from (
  select lower(trim(email))
  from public.subscribers
  group by lower(trim(email))
  having count(*) > 1
) as duplicate_subscribers
union all
select 'orders_with_non_array_items', count(*)
from public.orders
where items is not null
  and jsonb_typeof(items) <> 'array'
union all
select 'order_items_without_seller_id', count(*)
from public.orders as orders
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(orders.items) = 'array' then orders.items
    else '[]'::jsonb
  end
) as item
where nullif(trim(item ->> 'seller_id'), '') is null
union all
select 'orders_with_multiple_sellers', count(*)
from public.orders as orders
where (
  select count(distinct item ->> 'seller_id')
  from jsonb_array_elements(
    case
      when jsonb_typeof(orders.items) = 'array' then orders.items
      else '[]'::jsonb
    end
  ) as item
  where nullif(trim(item ->> 'seller_id'), '') is not null
) > 1;

-- After the migration has been applied, run this additional role distribution check:
-- select role, source, count(*) as users
-- from public.user_roles
-- group by role, source
-- order by role, source;

-- Every Auth user must have an active buyer capability after migration:
-- select count(*) as auth_users_missing_active_buyer_role
-- from auth.users as auth_user
-- where not exists (
--   select 1
--   from public.user_roles as user_role
--   where user_role.user_id = auth_user.id
--     and user_role.role = 'buyer'
-- );

-- After the migration, verify seller lifecycle distribution:
-- select status, activation_source, count(*) as sellers
-- from public.seller_accounts
-- group by status, activation_source
-- order by status, activation_source;
