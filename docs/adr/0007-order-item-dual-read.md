# ADR 0007: Prefer normalized order items with a legacy fallback

- Status: Accepted
- Date: 2026-09-15

## Context

New checkout writes both `order_items` and the legacy `orders.items` JSON
snapshot. Historical backfill intentionally skipped ambiguous or malformed
lines, so some old orders may not have a complete normalized representation.
Email and shipping Edge Functions still treated client-shaped JSON as their
only item source.

## Decision

1. Keep one shared adapter in `supabase/functions/_shared/orderItems.js` for
   querying and mapping immutable normalized lines.
2. Prefer `order_items` only when its ordered line numbers completely cover the
   legacy snapshot. Fall back to `orders.items` for incomplete historical data
   or a normalized read failure.
3. Preserve the existing item shape at the Edge Function boundary so email
   templates and shipping behavior do not change during the data-source cutover.
4. Load lines for a collection of orders in one batched query to avoid an N+1
   query pattern.
5. Use normalized catalog-derived `seller_id` values for Shippo seller
   authorization whenever the normalized aggregate is complete.
6. Run the shared adapter contract tests with the repository's Vitest suite.

## Scope

This decision applies to transactional order email, AI-chat order email, recent
order summaries, and Shippo seller authorization. Payment verification and
pricing logic remain unchanged until they receive provider-specific contract
and integration tests.

## Consequences

- New orders no longer depend on mutable legacy JSON for these read paths.
- Ambiguous historical orders remain readable without inventing missing data.
- Edge Functions use one documented conversion contract instead of duplicating
  ad hoc JSON parsing.
- The `items_source` diagnostic value identifies whether a request used
  `order_items` or `orders.items` without changing the public response.

## Removal gate

Do not remove `orders.items` until reconciliation proves every retained order
has a complete normalized line sequence and the remaining payment, reorder,
buyer, seller, and admin readers have moved to `order_items`.
