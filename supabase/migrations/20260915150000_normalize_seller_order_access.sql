-- Move seller order authorization to normalized order lines while retaining a
-- compatibility fallback for historical orders with incomplete backfills.

create or replace function public.seller_can_access_order(
  p_order_id bigint,
  p_seller_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with target_order as (
    select
      orders.items,
      case
        when jsonb_typeof(orders.items) = 'array'
          then jsonb_array_length(orders.items)
        else 0
      end as legacy_item_count
    from public.orders
    where orders.id = p_order_id
  ), normalized_stats as (
    select
      count(*)::integer as item_count,
      min(order_items.line_number) as min_line,
      max(order_items.line_number) as max_line
    from public.order_items
    where order_items.order_id = p_order_id
  )
  select coalesce(
    exists (
      select 1
      from public.order_items
      where order_items.order_id = p_order_id
        and order_items.seller_id = p_seller_id
    )
    or (
      not (
        normalized_stats.item_count > 0
        and (
          target_order.legacy_item_count = 0
          or (
            normalized_stats.item_count = target_order.legacy_item_count
            and normalized_stats.min_line = 1
            and normalized_stats.max_line = normalized_stats.item_count
          )
        )
      )
      and exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(target_order.items) = 'array'
              then target_order.items
            else '[]'::jsonb
          end
        ) as legacy_item
        where legacy_item ->> 'seller_id' = p_seller_id::text
      )
    ),
    false
  )
  from target_order
  cross join normalized_stats;
$$;

comment on function public.seller_can_access_order(bigint, uuid) is
  'Checks normalized seller ownership and uses legacy order JSON only when normalized lines are incomplete.';

revoke all on function public.seller_can_access_order(bigint, uuid)
  from public, anon;
grant execute on function public.seller_can_access_order(bigint, uuid)
  to authenticated, service_role;

drop policy if exists "Sellers can view orders containing their items"
  on public.orders;
create policy "Sellers can view orders containing their items"
  on public.orders
  for select
  to authenticated
  using (
    (select public.seller_can_access_order(orders.id, auth.uid()))
  );

drop policy if exists "Sellers can update orders containing their items"
  on public.orders;
create policy "Sellers can update orders containing their items"
  on public.orders
  for update
  to authenticated
  using (
    (select public.seller_can_access_order(orders.id, auth.uid()))
  )
  with check (
    (select public.seller_can_access_order(orders.id, auth.uid()))
  );
