-- Deterministic and idempotent backfill for canonical identities and normalized
-- commerce rows. Ambiguous values are skipped and remain available in legacy JSON
-- for later review; no legacy column or row is deleted here.

create or replace function public.backfill_relational_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Canonical buyer identity: only exact legacy UUID matches are accepted.
  update public.orders as target_order
  set buyer_id = auth_user.id
  from auth.users as auth_user
  where target_order.buyer_id is null
    and target_order.user_id = auth_user.id::text;

  -- Canonical review product identity: only an existing product can be linked.
  update public.reviews as target_review
  set product_uuid = product.id
  from public.products as product
  where target_review.product_uuid is null
    and target_review.product_id = product.id::text;

  -- Repair a legacy public.users id only when the row is orphaned, its email
  -- matches exactly one Auth identity, and the target public id is unused.
  with identity_candidates as (
    select
      app_user.id as legacy_id,
      auth_user.id as canonical_id,
      count(*) over (partition by app_user.id) as auth_match_count
    from public.users as app_user
    join auth.users as auth_user
      on lower(auth_user.email) = lower(app_user.email)
    where not exists (
      select 1 from auth.users where auth.users.id = app_user.id
    )
  ),
  safe_identity_matches as (
    select legacy_id, canonical_id
    from identity_candidates
    where auth_match_count = 1
      and not exists (
        select 1
        from public.users as existing_user
        where existing_user.id = identity_candidates.canonical_id
      )
  )
  update public.users as app_user
  set id = safe_match.canonical_id
  from safe_identity_matches as safe_match
  where app_user.id = safe_match.legacy_id;

  -- Re-run safe identity derivations so the procedure remains useful after a
  -- phased deploy. Conflicting emails and unknown identities are not guessed.
  insert into public.profiles (id, name)
  select
    auth_user.id,
    nullif(
      trim(
        coalesce(
          auth_user.raw_user_meta_data ->> 'name',
          auth_user.raw_user_meta_data ->> 'full_name',
          split_part(coalesce(auth_user.email, ''), '@', 1)
        )
      ),
      ''
    )
  from auth.users as auth_user
  on conflict (id) do nothing;

  insert into public.users (id, email, "cartData")
  select auth_user.id, auth_user.email, '{}'::jsonb
  from auth.users as auth_user
  where auth_user.email is not null
    and not exists (
      select 1 from public.users as app_user where app_user.id = auth_user.id
    )
    and not exists (
      select 1
      from public.users as app_user
      where lower(app_user.email) = lower(auth_user.email)
    )
  on conflict do nothing;

  insert into public.user_roles (user_id, role, source)
  select auth_user.id, 'buyer', 'auth_trigger'
  from auth.users as auth_user
  on conflict (user_id, role) do nothing;

  insert into public.user_roles (user_id, role, source)
  select seller.user_id, 'seller', 'inventory_backfill'
  from (
    select product.seller_id as user_id
    from public.products as product
    where product.seller_id is not null
    union
    select lend_item.seller_id as user_id
    from public.lend_items as lend_item
    where lend_item.seller_id is not null
  ) as seller
  join auth.users as auth_user on auth_user.id = seller.user_id
  on conflict (user_id, role) do nothing;

  insert into public.seller_accounts (
    user_id,
    status,
    activation_source,
    activated_at
  )
  select seller.user_id, 'active', 'inventory_backfill', now()
  from (
    select product.seller_id as user_id
    from public.products as product
    where product.seller_id is not null
    union
    select lend_item.seller_id as user_id
    from public.lend_items as lend_item
    where lend_item.seller_id is not null
  ) as seller
  join auth.users as auth_user on auth_user.id = seller.user_id
  on conflict (user_id) do nothing;

  -- Normalize order items only when quantity and money values are unambiguous.
  with raw_order_lines as (
    select
      legacy_order.id as order_id,
      legacy_order.created_at,
      legacy_order.charge_currency,
      line.item,
      line.line_number::integer,
      nullif(trim(line.item ->> 'id'), '') as raw_product_id,
      nullif(trim(line.item ->> 'seller_id'), '') as raw_seller_id,
      coalesce(nullif(trim(line.item ->> 'quantity'), ''), '1') as raw_quantity,
      case
        when jsonb_typeof(line.item -> 'rentInfo') = 'object'
          then nullif(trim(line.item #>> '{rentInfo,totalPrice}'), '')
        else nullif(trim(line.item ->> 'price'), '')
      end as raw_unit_amount,
      case
        when jsonb_typeof(line.item -> 'rentInfo') = 'object'
          or lower(coalesce(line.item ->> 'rentable', 'false')) = 'true'
          then 'rental'
        else 'purchase'
      end as item_type
    from public.orders as legacy_order
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(legacy_order.items) = 'array' then legacy_order.items
        else '[]'::jsonb
      end
    ) with ordinality as line(item, line_number)
  ),
  typed_order_lines as (
    select
      raw_line.*,
      case
        when raw_product_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then raw_product_id::uuid
      end as product_candidate,
      case
        when raw_seller_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then raw_seller_id::uuid
      end as seller_candidate,
      case
        when raw_quantity ~ '^[0-9]+$' then raw_quantity::numeric
      end as parsed_quantity,
      case
        when raw_unit_amount ~ '^[0-9]+([.][0-9]+)?$' then raw_unit_amount::numeric
      end as parsed_unit_amount
    from raw_order_lines as raw_line
  ),
  valid_order_lines as (
    select
      typed_line.*,
      product.id as product_id,
      coalesce(seller.id, product.seller_id) as seller_id,
      coalesce(nullif(trim(typed_line.item ->> 'name'), ''), product.name) as product_name
    from typed_order_lines as typed_line
    left join public.products as product on product.id = typed_line.product_candidate
    left join auth.users as seller on seller.id = typed_line.seller_candidate
    where typed_line.parsed_quantity between 1 and 2147483647
      and typed_line.parsed_unit_amount between 0 and 9999999999.99
      and typed_line.parsed_unit_amount * typed_line.parsed_quantity <= 9999999999.99
  )
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
    product_snapshot,
    created_at
  )
  select
    valid_line.order_id,
    valid_line.line_number,
    valid_line.product_id,
    valid_line.seller_id,
    valid_line.item_type,
    valid_line.product_name,
    valid_line.parsed_quantity::integer,
    valid_line.parsed_unit_amount,
    case
      when valid_line.item_type = 'rental' then valid_line.parsed_unit_amount
      else valid_line.parsed_unit_amount * valid_line.parsed_quantity
    end,
    case
      when valid_line.charge_currency ~ '^[A-Za-z]{3}$'
        then lower(valid_line.charge_currency)
      else 'usd'
    end,
    nullif(trim(valid_line.item ->> 'size'), ''),
    valid_line.item -> 'customization',
    valid_line.item,
    valid_line.created_at
  from valid_order_lines as valid_line
  where valid_line.product_name is not null
  on conflict (order_id, line_number) do nothing;

  -- A legacy order-level shipment can only be copied safely when one seller is
  -- represented. Multi-seller shipments remain pending for explicit reconciliation.
  with single_seller_orders as (
    select
      order_item.order_id,
      min(order_item.seller_id::text)::uuid as seller_id
    from public.order_items as order_item
    where order_item.seller_id is not null
    group by order_item.order_id
    having count(distinct order_item.seller_id) = 1
  )
  insert into public.seller_fulfillments (
    order_id,
    seller_id,
    shipping_provider,
    shipping_carrier,
    shipping_service,
    shipping_rate_amount,
    shipping_rate_currency,
    shipping_rate_id,
    shipping_transaction_id,
    shipping_label_url,
    tracking_number,
    tracking_url
  )
  select
    legacy_order.id,
    single_seller.seller_id,
    legacy_order.shipping_provider,
    legacy_order.shipping_carrier,
    legacy_order.shipping_service,
    legacy_order.shipping_rate_amount,
    case
      when legacy_order.shipping_rate_currency ~ '^[A-Za-z]{3}$'
        then lower(legacy_order.shipping_rate_currency)
    end,
    legacy_order.shipping_rate_id,
    legacy_order.shipping_transaction_id,
    legacy_order.shipping_label_url,
    coalesce(legacy_order.shipping_tracking_number, legacy_order.tracking_out),
    legacy_order.shipping_tracking_url
  from public.orders as legacy_order
  join single_seller_orders as single_seller
    on single_seller.order_id = legacy_order.id
  on conflict (order_id, seller_id) do nothing;

  -- Current cart object shape: { productId: { sizeKey: quantity|details } }.
  with object_cart_lines as (
    select
      cart.id as cart_id,
      cart.user_id,
      product_entry.key as raw_product_id,
      size_entry.key as size_key,
      size_entry.value as entry,
      case
        when jsonb_typeof(size_entry.value) = 'object'
          then size_entry.value ->> 'quantity'
        else size_entry.value #>> '{}'
      end as raw_quantity
    from public.carts as cart
    cross join lateral jsonb_each(
      case when jsonb_typeof(cart.items) = 'object' then cart.items else '{}'::jsonb end
    ) as product_entry(key, value)
    cross join lateral jsonb_each(
      case when jsonb_typeof(product_entry.value) = 'object' then product_entry.value else '{}'::jsonb end
    ) as size_entry(key, value)
  ),
  typed_object_cart_lines as (
    select
      raw_line.*,
      case
        when raw_line.raw_product_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then raw_line.raw_product_id::uuid
      end as product_candidate,
      case
        when raw_line.raw_quantity ~ '^[0-9]+$' then raw_line.raw_quantity::numeric
      end as quantity
    from object_cart_lines as raw_line
  ),
  valid_object_cart_lines as (
    select typed_line.*, product.id as product_id
    from typed_object_cart_lines as typed_line
    join public.products as product on product.id = typed_line.product_candidate
    where typed_line.quantity between 1 and 2147483647
  )
  insert into public.cart_items (
    cart_id,
    user_id,
    line_key,
    product_id,
    quantity,
    size,
    customization
  )
  select
    valid_line.cart_id,
    valid_line.user_id,
    valid_line.raw_product_id || ':' || valid_line.size_key,
    valid_line.product_id,
    valid_line.quantity::integer,
    case
      when valid_line.size_key like 'rent_%' then null
      else nullif(split_part(valid_line.size_key, '|custom:', 1), '')
    end,
    case
      when jsonb_typeof(valid_line.entry) = 'object'
        then valid_line.entry -> 'customization'
    end
  from valid_object_cart_lines as valid_line
  on conflict (cart_id, line_key) do nothing;

  -- Legacy reorder shape: [{ id, size, quantity, ... }].
  with array_cart_lines as (
    select
      cart.id as cart_id,
      cart.user_id,
      line.item,
      line.line_number,
      nullif(trim(line.item ->> 'id'), '') as raw_product_id,
      coalesce(nullif(trim(line.item ->> 'quantity'), ''), '1') as raw_quantity
    from public.carts as cart
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(cart.items) = 'array' then cart.items else '[]'::jsonb end
    ) with ordinality as line(item, line_number)
  ),
  typed_array_cart_lines as (
    select
      raw_line.*,
      case
        when raw_line.raw_product_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then raw_line.raw_product_id::uuid
      end as product_candidate,
      case
        when raw_line.raw_quantity ~ '^[0-9]+$' then raw_line.raw_quantity::numeric
      end as quantity
    from array_cart_lines as raw_line
  )
  insert into public.cart_items (
    cart_id,
    user_id,
    line_key,
    product_id,
    quantity,
    size,
    customization
  )
  select
    typed_line.cart_id,
    typed_line.user_id,
    typed_line.raw_product_id || ':' || coalesce(
      nullif(trim(typed_line.item ->> 'size_key'), ''),
      nullif(trim(typed_line.item ->> 'size'), ''),
      typed_line.line_number::text
    ),
    product.id,
    typed_line.quantity::integer,
    nullif(trim(typed_line.item ->> 'size'), ''),
    typed_line.item -> 'customization'
  from typed_array_cart_lines as typed_line
  join public.products as product on product.id = typed_line.product_candidate
  where typed_line.quantity between 1 and 2147483647
  on conflict (cart_id, line_key) do nothing;
end;
$$;

revoke all on function public.backfill_relational_data() from public, anon, authenticated;
grant execute on function public.backfill_relational_data() to service_role;

-- Current production volume is small enough for one transaction. The procedure is
-- retained so staging and recovery runs can prove idempotency.
select public.backfill_relational_data();
