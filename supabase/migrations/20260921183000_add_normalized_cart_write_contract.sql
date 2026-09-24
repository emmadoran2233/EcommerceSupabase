-- Expand phase: new clients write only cart_items. The legacy set_cart_line
-- overload remains temporarily so an already-open storefront is not broken.

create or replace function public.set_normalized_cart_line(
  p_product_id uuid,
  p_line_key text,
  p_quantity integer,
  p_size text,
  p_customization jsonb,
  p_rental_start_date date,
  p_rental_end_date date,
  p_rental_quote jsonb
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
  if p_rental_quote is not null and jsonb_typeof(p_rental_quote) <> 'object' then
    raise exception 'Rental quote must be a JSON object' using errcode = '22023';
  end if;

  insert into public.carts (user_id, updated_at)
  values (current_user_id, now())
  on conflict (user_id) do update set updated_at = now()
  returning id into current_cart_id;

  if p_quantity = 0 then
    delete from public.cart_items
    where cart_id = current_cart_id and line_key = p_line_key;
    return current_cart_id;
  end if;

  if p_product_id is null then
    raise exception 'Product id is required for an active cart line'
      using errcode = '22023';
  end if;

  insert into public.cart_items (
    cart_id, user_id, line_key, product_id, quantity, size, customization,
    rental_start_date, rental_end_date, rental_quote
  )
  values (
    current_cart_id, current_user_id, p_line_key, p_product_id, p_quantity,
    p_size, p_customization, p_rental_start_date, p_rental_end_date,
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

comment on function public.set_normalized_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb
) is
  'Atomically updates one normalized cart line without writing the legacy carts.items snapshot.';

revoke all on function public.set_normalized_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb
) from public, anon;
grant execute on function public.set_normalized_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb
) to authenticated, service_role;
