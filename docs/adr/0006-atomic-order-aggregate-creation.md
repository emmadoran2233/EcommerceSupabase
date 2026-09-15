# ADR 0006: Create the order aggregate atomically

- Status: Accepted
- Date: 2026-09-15

## Context

The storefront previously inserted only an `orders` row. Normalized
`order_items` and `seller_fulfillments` were populated only by a historical
backfill, so newly created orders could have no relational lines. A browser
could also submit buyer identity, paid state, and order status even though those
values belong to trusted server workflows.

## Decision

1. Route storefront order creation through
   `public.create_order_with_items(jsonb)`.
2. Create the order header, immutable item snapshots, and one fulfillment per
   catalog seller in a single database transaction.
3. Take buyer identity from `auth.uid()` and force new orders to unpaid and
   `Order Placed`, ignoring privileged client values.
4. Resolve seller ownership from `products.seller_id`, never from item JSON.
5. Require a client-generated `checkout_request_id` and serialize equal keys
   with a transaction advisory lock. A retry returns the original order id.
6. Reject invalid or missing products, quantities, amounts, and rental dates so
   no partial aggregate remains.
7. Keep legacy `orders.items` during the compatibility window because existing
   payment, email, shipping, buyer, and seller readers still use it.

## Explicit non-goals

- This change does not activate a payment provider or perform a live charge.
- It does not make rental pricing server-authoritative. Purchase and rental
  amounts still arrive in the existing browser snapshot contract.
- It does not remove legacy order price, payment, shipping, or JSON columns.
- It does not clear carts when hosted payment initialization fails.

Those trust-boundary and contract changes require dedicated Edge Function tests
before live payment activation.

## Consequences

- Every new storefront order has normalized order lines immediately.
- Multi-seller fulfillment authorization no longer depends solely on parsing
  order JSON.
- Customization data becomes an immutable order-line snapshot.
- Direct inserts remain temporarily available for compatibility but are no
  longer used by the storefront checkout gateway.

## Rollback

Restore the previous checkout gateway first, then run
`supabase/rollback/20260915_atomic_order_creation.sql`. Existing orders and
normalized records are retained.
