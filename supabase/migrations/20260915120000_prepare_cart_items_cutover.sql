-- Prepare a behavior-preserving frontend cutover from carts.items JSON to
-- normalized cart_items rows. The compatibility JSON remains until all readers
-- have moved and production reconciliation is complete.

alter table public.cart_items
  add column if not exists rental_quote jsonb;

comment on column public.cart_items.rental_quote is
  'Display-only rental quote captured in the cart. Checkout must recalculate authoritative prices.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cart_items_rental_quote_object'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      add constraint cart_items_rental_quote_object
      check (rental_quote is null or jsonb_typeof(rental_quote) = 'object')
      not valid;
  end if;
end
$$;

-- Recover rental details that the first relational backfill intentionally left
-- in the legacy JSON. Invalid dates remain null instead of being guessed.
with legacy_rental_lines as (
  select
    cart.id as cart_id,
    product_entry.key || ':' || size_entry.key as line_key,
    size_entry.value -> 'rentInfo' as rental_quote,
    size_entry.value #>> '{rentInfo,startDate}' as raw_start_date,
    size_entry.value #>> '{rentInfo,endDate}' as raw_end_date
  from public.carts as cart
  cross join lateral jsonb_each(
    case when jsonb_typeof(cart.items) = 'object' then cart.items else '{}'::jsonb end
  ) as product_entry(key, value)
  cross join lateral jsonb_each(
    case
      when jsonb_typeof(product_entry.value) = 'object' then product_entry.value
      else '{}'::jsonb
    end
  ) as size_entry(key, value)
  where jsonb_typeof(size_entry.value -> 'rentInfo') = 'object'
)
update public.cart_items as cart_item
set
  rental_quote = legacy_line.rental_quote,
  rental_start_date = case
    when legacy_line.raw_start_date ~ '^\d{4}-\d{2}-\d{2}'
      then left(legacy_line.raw_start_date, 10)::date
    else cart_item.rental_start_date
  end,
  rental_end_date = case
    when legacy_line.raw_end_date ~ '^\d{4}-\d{2}-\d{2}'
      then left(legacy_line.raw_end_date, 10)::date
    else cart_item.rental_end_date
  end
from legacy_rental_lines as legacy_line
where cart_item.cart_id = legacy_line.cart_id
  and cart_item.line_key = legacy_line.line_key
  and cart_item.rental_quote is null;

alter table public.cart_items
  validate constraint cart_items_rental_quote_object;

create or replace function public.set_cart_line(
  p_product_id uuid,
  p_line_key text,
  p_quantity integer,
  p_size text,
  p_customization jsonb,
  p_rental_start_date date,
  p_rental_end_date date,
  p_rental_quote jsonb,
  p_legacy_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_cart_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_line_key is null or length(trim(p_line_key)) = 0 then
    raise exception 'Cart line key is required' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity < 0 then
    raise exception 'Cart quantity must be zero or greater' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_legacy_items, '{}'::jsonb)) <> 'object' then
    raise exception 'Legacy cart snapshot must be a JSON object' using errcode = '22023';
  end if;

  if p_rental_quote is not null and jsonb_typeof(p_rental_quote) <> 'object' then
    raise exception 'Rental quote must be a JSON object' using errcode = '22023';
  end if;

  insert into public.carts (user_id, items, updated_at)
  values (current_user_id, coalesce(p_legacy_items, '{}'::jsonb), now())
  on conflict (user_id) do update
  set
    items = excluded.items,
    updated_at = excluded.updated_at
  returning id into current_cart_id;

  if p_quantity = 0 then
    delete from public.cart_items
    where cart_id = current_cart_id
      and line_key = p_line_key;

    return current_cart_id;
  end if;

  if p_product_id is null then
    raise exception 'Product id is required for an active cart line'
      using errcode = '22023';
  end if;

  insert into public.cart_items (
    cart_id,
    user_id,
    line_key,
    product_id,
    quantity,
    size,
    customization,
    rental_start_date,
    rental_end_date,
    rental_quote
  )
  values (
    current_cart_id,
    current_user_id,
    p_line_key,
    p_product_id,
    p_quantity,
    p_size,
    p_customization,
    p_rental_start_date,
    p_rental_end_date,
    p_rental_quote
  )
  on conflict (cart_id, line_key) do update
  set
    product_id = excluded.product_id,
    quantity = excluded.quantity,
    size = excluded.size,
    customization = excluded.customization,
    rental_start_date = excluded.rental_start_date,
    rental_end_date = excluded.rental_end_date,
    rental_quote = excluded.rental_quote,
    updated_at = now();

  return current_cart_id;
end;
$$;

comment on function public.set_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb, jsonb
) is
  'Atomically updates one normalized cart line and its temporary legacy JSON snapshot for the authenticated user.';

revoke all on function public.set_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb, jsonb
) from public, anon;

grant execute on function public.set_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb, jsonb
) to authenticated;

grant execute on function public.set_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb, jsonb
) to service_role;
