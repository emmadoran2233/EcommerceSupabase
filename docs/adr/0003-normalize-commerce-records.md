# ADR 0003: Normalize transactional commerce records

- Status: Accepted
- Date: 2026-09-08

## Context

Orders and carts currently store line items in JSON. Seller ownership is embedded in
order JSON, while payment, rental, and shipping state share the orders table. This makes
foreign keys impossible, forces RLS to parse JSON, and prevents independent fulfillment
for multi-seller orders.

## Decision

1. Keep `orders` as the buyer-level commercial transaction.
2. Add `order_items` as immutable line snapshots with product and seller foreign keys.
3. Add `seller_fulfillments` for per-seller shipping and status.
4. Add `order_payments` with integer minor-unit amounts and provider-neutral status.
5. Add `cart_items` while keeping legacy `carts.items` during migration.
6. Preserve `orders.items`, payment columns, and shipping columns until backfill,
   dual-read verification, and Edge Function tests are complete.
7. Product deletion may null historical order references but must not delete order lines.

## Consequences

- Multi-seller authorization becomes indexable instead of JSON-dependent.
- Payment and fulfillment workflows can evolve independently.
- Temporary duplication is expected during expand-migrate-contract rollout.
- Backfill must preserve item count, seller ownership, totals, rental dates, and snapshots.

