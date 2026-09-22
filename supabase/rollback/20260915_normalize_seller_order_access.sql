begin;

drop policy if exists "Sellers can view orders containing their items"
  on public.orders;
create policy "Sellers can view orders containing their items"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(items) = 'array' then items
          else '[]'::jsonb
        end
      ) as item
      where item ->> 'seller_id' = (select auth.uid())::text
    )
  );

drop policy if exists "Sellers can update orders containing their items"
  on public.orders;
create policy "Sellers can update orders containing their items"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(items) = 'array' then items
          else '[]'::jsonb
        end
      ) as item
      where item ->> 'seller_id' = (select auth.uid())::text
    )
  )
  with check (
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(items) = 'array' then items
          else '[]'::jsonb
        end
      ) as item
      where item ->> 'seller_id' = (select auth.uid())::text
    )
  );

drop function if exists public.seller_can_access_order(bigint, uuid);

commit;
