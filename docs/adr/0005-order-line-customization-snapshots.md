# ADR 0005: Store customization on cart and order lines

- Status: Accepted
- Date: 2026-09-15

## Context

The storefront treated `customizations` as a user-owned record, while checkout
already copied the selected customization into the cart item and legacy order
item JSON. A `user_id` cannot identify one customization because a user can
customize many products. An `order_id` also cannot identify one customization
because an order can contain many customized lines.

The deployed `customizations` table does not contain every column requested by
the Product page, so its persistence path already falls back to local state.

## Decision

1. A customization selected for purchase belongs to a cart line before checkout
   and to an immutable order line after checkout.
2. Keep the customization snapshot inside `cart_items.customization` and
   `order_items.customization`.
3. The snapshot has its own client-generated id so two configurations of the
   same product remain separate cart lines.
4. Stop reading from and writing to the legacy `customizations` table in the
   Product page.
5. Keep the legacy table during the expand-migrate-contract window. Do not map
   historical rows to orders unless a deterministic cart/order-line reference
   exists.
6. If reusable templates become a product requirement later, introduce an
   explicitly named `customization_templates` aggregate with its own primary
   key. Do not overload order snapshots for that purpose.

## Consequences

- Customizations no longer need `user_id` or `order_id` as a primary key.
- Editing a customization preserves its snapshot id and therefore updates the
  same logical cart configuration.
- The cart repository persists the snapshot atomically with the cart line.
- New order writes must populate normalized `order_items` before the legacy
  `customizations` table can be removed.

## Retirement gate

Drop `public.customizations` only after:

1. deployed storefront traffic no longer reads or writes it;
2. new orders create normalized `order_items` with customization snapshots;
3. production reconciliation reports no safely mappable snapshots missing from
   cart or order lines;
4. the rollback observation window has completed.
