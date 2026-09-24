-- Create the order aggregate in one transaction. Existing direct-insert readers
-- remain compatible during rollout, but the storefront moves to this function.

alter table public.orders
  add column if not exists checkout_request_id uuid;

create unique index if not exists idx_orders_checkout_request_id
  on public.orders (checkout_request_id)
  where checkout_request_id is not null;

comment on column public.orders.checkout_request_id is
  'Client-generated idempotency key reused when the same checkout request is retried.';

create or replace function public.create_order_with_items(p_order jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_id uuid;
  existing_order_id bigint;
  created_order_id bigint;
  order_items_json jsonb := p_order -> 'items';
  order_address jsonb := p_order -> 'address';
  payment_method text := lower(trim(coalesce(p_order ->> 'paymentmethod', '')));
  currency text := lower(trim(coalesce(p_order ->> 'charge_currency', 'usd')));
  order_line record;
  raw_product_id text;
  raw_quantity text;
  raw_unit_amount text;
  line_product_id uuid;
  line_seller_id uuid;
  line_product_name text;
  catalog_product_name text;
  line_quantity integer;
  line_unit_amount numeric(12, 2);
  line_amount numeric(12, 2);
  line_item_type text;
  line_start_date date;
  line_end_date date;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  begin
    request_id := nullif(trim(p_order ->> 'checkout_request_id'), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'A valid checkout request id is required' using errcode = '22023';
  end;

  if request_id is null then
    raise exception 'A valid checkout request id is required' using errcode = '22023';
  end if;

  if jsonb_typeof(order_items_json) <> 'array'
    or jsonb_array_length(order_items_json) = 0 then
    raise exception 'Order items must be a non-empty JSON array' using errcode = '22023';
  end if;

  if jsonb_typeof(order_address) <> 'object' then
    raise exception 'Order address must be a JSON object' using errcode = '22023';
  end if;

  if payment_method not in ('cod', 'stripe', 'googlepay', 'razorpay') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  if currency !~ '^[a-z]{3}$' then
    raise exception 'Order currency must be a three-letter code' using errcode = '22023';
  end if;

  -- Serialize retries carrying the same idempotency key before checking for an
  -- existing order. This prevents two concurrent requests from creating twins.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(request_id::text, 0)
  );

  select orders.id
  into existing_order_id
  from public.orders
  where orders.checkout_request_id = request_id
    and orders.buyer_id = current_user_id;

  if existing_order_id is not null then
    return existing_order_id;
  end if;

  insert into public.orders (
    items,
    address,
    paymentmethod,
    payment,
    date,
    amount,
    status,
    user_id,
    buyer_id,
    rent_subtotal,
    purchase_subtotal,
    shipping_fee,
    deposit_total,
    deposit_currency,
    charge_currency,
    rent_breakdown,
    deposit_metadata,
    checkout_request_id
  )
  values (
    order_items_json,
    order_address,
    payment_method,
    false,
    now(),
    coalesce(nullif(trim(p_order ->> 'amount'), '')::numeric, 0),
    'Order Placed',
    current_user_id::text,
    current_user_id,
    coalesce(nullif(trim(p_order ->> 'rent_subtotal'), '')::numeric, 0),
    coalesce(nullif(trim(p_order ->> 'purchase_subtotal'), '')::numeric, 0),
    coalesce(nullif(trim(p_order ->> 'shipping_fee'), '')::numeric, 0),
    coalesce(nullif(trim(p_order ->> 'deposit_total'), '')::numeric, 0),
    lower(trim(coalesce(p_order ->> 'deposit_currency', 'usd'))),
    currency,
    case
      when jsonb_typeof(p_order -> 'rent_breakdown') = 'array'
        then p_order -> 'rent_breakdown'
      else '[]'::jsonb
    end,
    case
      when jsonb_typeof(p_order -> 'deposit_metadata') = 'object'
        then p_order -> 'deposit_metadata'
      else '{}'::jsonb
    end,
    request_id
  )
  returning id into created_order_id;

  for order_line in
    select line.value as item, line.ordinality::integer as line_number
    from jsonb_array_elements(order_items_json) with ordinality as line(value, ordinality)
  loop
    raw_product_id := nullif(trim(order_line.item ->> 'id'), '');
    if raw_product_id is null
      or raw_product_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Order line % has an invalid product id', order_line.line_number
        using errcode = '22023';
    end if;
    line_product_id := raw_product_id::uuid;

    select product.name, product.seller_id
    into catalog_product_name, line_seller_id
    from public.products as product
    where product.id = line_product_id;

    if not found then
      raise exception 'Order line % references a missing product', order_line.line_number
        using errcode = '23503';
    end if;

    if exists (
      select 1
      from public.seller_accounts as seller_account
      where seller_account.user_id = line_seller_id
        and seller_account.status = 'suspended'
    ) then
      raise exception 'Order line % belongs to a suspended seller', order_line.line_number
        using errcode = '42501';
    end if;

    raw_quantity := coalesce(nullif(trim(order_line.item ->> 'quantity'), ''), '1');
    if raw_quantity !~ '^[0-9]+$'
      or raw_quantity::numeric not between 1 and 2147483647 then
      raise exception 'Order line % has an invalid quantity', order_line.line_number
        using errcode = '22023';
    end if;
    line_quantity := raw_quantity::integer;

    if jsonb_typeof(order_line.item -> 'rentInfo') = 'object' then
      line_item_type := 'rental';
      raw_unit_amount := nullif(
        trim(order_line.item #>> '{rentInfo,totalPrice}'),
        ''
      );
    else
      line_item_type := 'purchase';
      raw_unit_amount := nullif(trim(order_line.item ->> 'price'), '');
    end if;

    if raw_unit_amount is null
      or raw_unit_amount !~ '^[0-9]+([.][0-9]+)?$'
      or raw_unit_amount::numeric > 9999999999.99 then
      raise exception 'Order line % has an invalid amount', order_line.line_number
        using errcode = '22023';
    end if;
    line_unit_amount := raw_unit_amount::numeric(12, 2);
    line_amount := case
      when line_item_type = 'rental' then line_unit_amount
      else line_unit_amount * line_quantity
    end;

    if line_amount > 9999999999.99 then
      raise exception 'Order line % amount exceeds the supported range', order_line.line_number
        using errcode = '22003';
    end if;

    line_product_name := coalesce(
      nullif(trim(order_line.item ->> 'name'), ''),
      catalog_product_name
    );

    line_start_date := case
      when order_line.item #>> '{rentInfo,startDate}' ~ '^\d{4}-\d{2}-\d{2}'
        then left(order_line.item #>> '{rentInfo,startDate}', 10)::date
    end;
    line_end_date := case
      when order_line.item #>> '{rentInfo,endDate}' ~ '^\d{4}-\d{2}-\d{2}'
        then left(order_line.item #>> '{rentInfo,endDate}', 10)::date
    end;

    insert into public.order_items (
      order_id,
      line_number,
      product_id,
      seller_id,
      item_type,
      product_name,
      quantity,
      unit_amount,
      line_amount,
      currency,
      size,
      customization,
      rental_start_date,
      rental_end_date,
      product_snapshot
    )
    values (
      created_order_id,
      order_line.line_number,
      line_product_id,
      line_seller_id,
      line_item_type,
      line_product_name,
      line_quantity,
      line_unit_amount,
      line_amount,
      currency,
      nullif(trim(order_line.item ->> 'size'), ''),
      case
        when jsonb_typeof(order_line.item -> 'customization') = 'object'
          then order_line.item -> 'customization'
      end,
      line_start_date,
      line_end_date,
      order_line.item
    );
  end loop;

  insert into public.seller_fulfillments (order_id, seller_id)
  select distinct created_order_id, order_item.seller_id
  from public.order_items as order_item
  where order_item.order_id = created_order_id
    and order_item.seller_id is not null
  on conflict (order_id, seller_id) do nothing;

  return created_order_id;
end;
$$;

comment on function public.create_order_with_items(jsonb) is
  'Idempotently creates an authenticated buyer order, immutable order lines, and per-seller fulfillment rows in one transaction.';

revoke all on function public.create_order_with_items(jsonb) from public, anon;
grant execute on function public.create_order_with_items(jsonb) to authenticated;
grant execute on function public.create_order_with_items(jsonb) to service_role;
