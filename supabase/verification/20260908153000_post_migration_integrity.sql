-- Run after the schema migrations. This script is read-only and returns counts only.

select 'unvalidated_foreign_keys' as check_name, count(*) as affected_rows
from pg_constraint
where contype = 'f'
  and not convalidated
  and connamespace = 'public'::regnamespace
union all
select 'unvalidated_check_constraints', count(*)
from pg_constraint
where contype = 'c'
  and not convalidated
  and connamespace = 'public'::regnamespace
union all
select 'users_without_any_role', count(*)
from auth.users as auth_user
where not exists (
  select 1
  from public.user_roles as user_role
  where user_role.user_id = auth_user.id
)
union all
select 'seller_roles_without_seller_account', count(*)
from public.user_roles as user_role
where user_role.role = 'seller'
  and not exists (
    select 1
    from public.seller_accounts as seller_account
    where seller_account.user_id = user_role.user_id
  )
union all
select 'active_sellers_without_seller_role', count(*)
from public.seller_accounts as seller_account
where seller_account.status = 'active'
  and not exists (
    select 1
    from public.user_roles as user_role
    where user_role.user_id = seller_account.user_id
      and user_role.role = 'seller'
  )
union all
select 'legacy_orders_not_backfilled_to_order_items', count(*)
from public.orders as orders
where jsonb_typeof(orders.items) = 'array'
  and jsonb_array_length(orders.items) > 0
  and not exists (
    select 1 from public.order_items where order_items.order_id = orders.id
  )
union all
select 'legacy_carts_not_backfilled_to_cart_items', count(*)
from public.carts as carts
where carts.items <> '{}'::jsonb
  and not exists (
    select 1 from public.cart_items where cart_items.cart_id = carts.id
  );

select role, source, count(*) as users
from public.user_roles
group by role, source
order by role, source;

select status, activation_source, count(*) as sellers
from public.seller_accounts
group by status, activation_source
order by status, activation_source;
