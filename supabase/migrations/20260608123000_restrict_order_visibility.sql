-- 6.6 Protect orders at the database level so users cannot read or write other users' orders.
do $$
begin
-- 1. self check
  if to_regclass('public.orders') is null then
    raise notice 'Skipping order visibility policies because public.orders does not exist.';
    return;
  end if;
-- 2. make sure `orders` has `buyer_id` info
  alter table public.orders
    add column if not exists buyer_id uuid references auth.users(id) on delete set null;

-- 3. delete old orders
  update public.orders
    set buyer_id = user_id::uuid
    where buyer_id is null
      and user_id is not null
      and user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  create index if not exists idx_orders_buyer_id
    on public.orders (buyer_id);

-- open RLS for `orders`
  alter table public.orders enable row level security;
-- 4. allow buyer check selfs orders
  drop policy if exists "Buyers can view their own orders" on public.orders;
  create policy "Buyers can view their own orders"
    on public.orders
    for select
    using (
      auth.uid() = buyer_id
      or auth.uid()::text = user_id
    );
-- 5. allow seller check selfs orders
  drop policy if exists "Sellers can view orders containing their items" on public.orders;
  create policy "Sellers can view orders containing their items"
    on public.orders
    for select
    using (
      exists (
        select 1
        from jsonb_array_elements(coalesce(items::jsonb, '[]'::jsonb)) as item
        where item->>'seller_id' = auth.uid()::text
      )
    );

  drop policy if exists "Buyers can create their own orders" on public.orders;
  create policy "Buyers can create their own orders"
    on public.orders
    for insert
    with check (
      auth.uid() = buyer_id
      and (user_id is null or auth.uid()::text = user_id)
    );

  drop policy if exists "Sellers can update orders containing their items" on public.orders;
  create policy "Sellers can update orders containing their items"
    on public.orders
    for update
    using (
      exists (
        select 1
        from jsonb_array_elements(coalesce(items::jsonb, '[]'::jsonb)) as item
        where item->>'seller_id' = auth.uid()::text
      )
    )
    with check (
      exists (
        select 1
        from jsonb_array_elements(coalesce(items::jsonb, '[]'::jsonb)) as item
        where item->>'seller_id' = auth.uid()::text
      )
    );
end $$;
