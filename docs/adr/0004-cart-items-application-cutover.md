# ADR 0004: Cut cart application traffic over to relational rows

- Status: Accepted
- Date: 2026-09-15

## Context

The storefront keeps its in-memory cart in the legacy object shape and writes the
whole object to `carts.items`. The normalized `cart_items` table is already
backfilled, indexed, and protected by RLS, but no application reader or writer
uses it yet. A direct destructive switch could hide historical lines that could
not be matched to a product during backfill.

## Decision

1. Keep the existing UI cart shape during this behavior-preserving step.
2. Put pure legacy/relational conversion rules in `domain/cart/cartState.js`.
3. Put Supabase queries in `infrastructure/cart/cartRepository.js`.
4. Update one normalized line and the temporary legacy JSON snapshot atomically
   through `public.set_cart_line`.
5. Prefer normalized reads only when they cover every active legacy line;
   otherwise return the legacy snapshot and flag the source as
   `legacy-fallback`.
6. Store the rental quote as display-only cart data. Checkout must eventually
   calculate authoritative prices on the server.
7. Keep `carts.items` until production reconciliation, Edge Function tests, and
   an observation window prove that all readers have moved.

## Consequences

- The frontend no longer contains direct cart table mutation queries.
- A failed database mutation is surfaced and the cart is reloaded from the
  server instead of silently diverging.
- Cart writes remain compatible with old readers during rollout.
- The compatibility JSON and `rental_quote` are temporary contract fields and
  require a later contract migration.
- Concurrent browser tabs still use last-write-wins semantics for the legacy
  snapshot. Optimistic versioning is a separate follow-up if multi-tab conflict
  frequency justifies it.

## Rollback

Restore the previous frontend first, then run
`supabase/rollback/20260915_cart_items_cutover.sql`. Because every mutation keeps
`carts.items` synchronized, rollback does not require reconstructing cart data.
