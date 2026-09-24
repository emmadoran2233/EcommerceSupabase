-- Reorder an owned order into the normalized cart in one transaction. The
-- legacy carts.items snapshot is rebuilt from cart_items for compatibility.

create or replace function public.reorder_into_cart(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  source_items jsonb;
  source_name text;
  legacy_item_count integer;
  normalized_item_count integer;
  normalized_min_line integer;
  normalized_max_line integer;
  current_cart_id uuid;
  order_line record;
  raw_product_id text;
  raw_quantity text;
  line_product_id uuid;
  line_quantity integer;
  line_size text;
  cart_line_key text;
  line_customization jsonb;
  line_rental_quote jsonb;
  line_start_date date;
  line_end_date date;
  customization_id text;
  added_line_count integer := 0;
  skipped_line_count integer := 0;
  rebuilt_legacy_items jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select
    case
      when jsonb_typeof(orders.items) = 'array' then orders.items
      else '[]'::jsonb
    end,
    case
      when jsonb_typeof(orders.items) = 'array'
        then jsonb_array_length(orders.items)
      else 0
    end
  into source_items, legacy_item_count
  from public.orders
  where orders.id = p_order_id
    and (
      orders.buyer_id = current_user_id
      or orders.user_id = current_user_id::text
    );

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select count(*), min(line_number), max(line_number)
  into normalized_item_count, normalized_min_line, normalized_max_line
  from public.order_items
  where order_id = p_order_id;

  if normalized_item_count > 0
    and (
      legacy_item_count = 0
      or (
        normalized_item_count = legacy_item_count
        and normalized_min_line = 1
        and normalized_max_line = normalized_item_count
      )
    ) then
    select jsonb_agg(
      order_item.product_snapshot
      || jsonb_strip_nulls(
        jsonb_build_object(
          'id', order_item.product_id,
          'seller_id', order_item.seller_id,
          'name', order_item.product_name,
          'quantity', order_item.quantity,
          'price', order_item.unit_amount,
          'size', order_item.size,
          'customization', order_item.customization
        )
      )
      || case
        when order_item.item_type = 'rental' then
          jsonb_build_object(
            'rentable', true,
            'rentInfo',
              coalesce(order_item.product_snapshot -> 'rentInfo', '{}'::jsonb)
              || jsonb_strip_nulls(
                jsonb_build_object(
                  'startDate', order_item.rental_start_date,
                  'endDate', order_item.rental_end_date,
                  'rentFee', order_item.line_amount
                )
              )
          )
        else '{}'::jsonb
      end
      order by order_item.line_number
    )
    into source_items
    from public.order_items as order_item
    where order_item.order_id = p_order_id;

    source_name := 'order_items';
  else
    source_name := 'orders.items';
  end if;

  insert into public.carts (user_id, items, updated_at)
  values (current_user_id, '{}'::jsonb, now())
  on conflict (user_id) do update
  set updated_at = now()
  returning id into current_cart_id;

  for order_line in
    select line.value as item
    from jsonb_array_elements(coalesce(source_items, '[]'::jsonb))
      with ordinality as line(value, line_number)
  loop
    raw_product_id := nullif(trim(order_line.item ->> 'id'), '');

    begin
      line_product_id := raw_product_id::uuid;
    exception when invalid_text_representation then
      skipped_line_count := skipped_line_count + 1;
      continue;
    end;

    if line_product_id is null
      or not exists (
        select 1 from public.products where products.id = line_product_id
      ) then
      skipped_line_count := skipped_line_count + 1;
      continue;
    end if;

    raw_quantity := nullif(trim(order_line.item ->> 'quantity'), '');
    line_quantity := case
      when raw_quantity ~ '^[1-9][0-9]*$'
        and raw_quantity::numeric <= 2147483647
        then raw_quantity::integer
      else 1
    end;
    line_size := nullif(trim(order_line.item ->> 'size'), '');
    line_customization := case
      when jsonb_typeof(order_line.item -> 'customization') = 'object'
        then order_line.item -> 'customization'
    end;
    line_rental_quote := case
      when jsonb_typeof(order_line.item -> 'rentInfo') = 'object'
        then order_line.item -> 'rentInfo'
    end;

    begin
      line_start_date := case
        when order_line.item #>> '{rentInfo,startDate}' ~ '^\d{4}-\d{2}-\d{2}'
          then left(order_line.item #>> '{rentInfo,startDate}', 10)::date
      end;
    exception when datetime_field_overflow or invalid_datetime_format then
      line_start_date := null;
    end;

    begin
      line_end_date := case
        when order_line.item #>> '{rentInfo,endDate}' ~ '^\d{4}-\d{2}-\d{2}'
          then left(order_line.item #>> '{rentInfo,endDate}', 10)::date
      end;
    exception when datetime_field_overflow or invalid_datetime_format then
      line_end_date := null;
    end;
    customization_id := nullif(trim(line_customization ->> 'id'), '');

    cart_line_key := line_product_id::text || ':' || case
      when line_rental_quote is not null
        and line_start_date is not null
        and line_end_date is not null
        then 'rent_' || line_start_date::text || '_to_' || line_end_date::text
      when customization_id is not null
        then coalesce(line_size, 'One Size') || '|custom:' || customization_id
      else coalesce(line_size, 'One Size')
    end;

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
      cart_line_key,
      line_product_id,
      line_quantity,
      case when line_rental_quote is null then line_size end,
      line_customization,
      line_start_date,
      line_end_date,
      line_rental_quote
    )
    on conflict (cart_id, line_key) do update
    set
      quantity = public.cart_items.quantity + excluded.quantity,
      product_id = excluded.product_id,
      size = excluded.size,
      customization = excluded.customization,
      rental_start_date = excluded.rental_start_date,
      rental_end_date = excluded.rental_end_date,
      rental_quote = excluded.rental_quote,
      updated_at = now();

    added_line_count := added_line_count + 1;
  end loop;

  with cart_line_values as (
    select
      cart_item.product_id::text as product_key,
      substring(
        cart_item.line_key
        from length(cart_item.product_id::text) + 2
      ) as size_key,
      cart_item.line_key,
      case
        when cart_item.rental_quote is not null then
          jsonb_build_object(
            'quantity', cart_item.quantity,
            'rentInfo',
              cart_item.rental_quote
              || jsonb_strip_nulls(
                jsonb_build_object(
                  'startDate', cart_item.rental_start_date,
                  'endDate', cart_item.rental_end_date
                )
              )
          )
        when cart_item.customization is not null then
          jsonb_strip_nulls(
            jsonb_build_object(
              'quantity', cart_item.quantity,
              'baseSize', cart_item.size,
              'customization', cart_item.customization
            )
          )
        else to_jsonb(cart_item.quantity)
      end as line_value
    from public.cart_items as cart_item
    where cart_item.cart_id = current_cart_id
  ), cart_products as (
    select
      product_key,
      jsonb_object_agg(size_key, line_value order by line_key) as sizes
    from cart_line_values
    group by product_key
  )
  select coalesce(
    jsonb_object_agg(product_key, sizes order by product_key),
    '{}'::jsonb
  )
  into rebuilt_legacy_items
  from cart_products;

  update public.carts
  set items = rebuilt_legacy_items, updated_at = now()
  where id = current_cart_id;

  return jsonb_build_object(
    'cart_id', current_cart_id,
    'source', source_name,
    'added_line_count', added_line_count,
    'skipped_line_count', skipped_line_count
  );
end;
$$;

comment on function public.reorder_into_cart(bigint) is
  'Atomically merges an owned order into normalized cart lines and rebuilds the temporary legacy cart snapshot.';

revoke all on function public.reorder_into_cart(bigint) from public, anon;
grant execute on function public.reorder_into_cart(bigint) to authenticated;
grant execute on function public.reorder_into_cart(bigint) to service_role;
