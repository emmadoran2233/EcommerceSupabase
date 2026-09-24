begin;

drop function if exists public.update_seller_fulfillment(bigint, text, text, text);

alter table public.seller_fulfillments
  drop constraint if exists seller_fulfillments_status_check;
alter table public.seller_fulfillments
  add constraint seller_fulfillments_status_check
  check (status in ('pending', 'packing', 'shipped', 'delivered', 'cancelled'));

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

commit;
