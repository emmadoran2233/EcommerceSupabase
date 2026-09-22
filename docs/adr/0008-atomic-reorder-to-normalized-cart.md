# ADR 0008: Reorder into the normalized cart atomically

- Status: Accepted
- Date: 2026-09-15

## Context

The reorder Edge Function previously read `orders.items`, merged arrays in
JavaScript, and wrote only `carts.items` with a Service Role client. The flow
was not transactional, did not populate `cart_items`, and accepted a redundant
client-provided user identifier.

## Decision

1. Put reorder ownership validation and cart mutation in
   `public.reorder_into_cart(bigint)`.
2. Derive the buyer from `auth.uid()` and never accept buyer identity from the
   request body.
3. Prefer complete normalized `order_items`; retain a deterministic legacy
   fallback for historical orders whose normalized lines are incomplete.
4. Merge all eligible lines into `cart_items` and rebuild the temporary
   `carts.items` compatibility snapshot in the same database transaction.
5. Serialize concurrent changes through the buyer's cart row and use atomic
   conflict updates to add quantities.
6. Keep the Edge Function as an HTTP adapter using the authenticated client. It
   no longer needs the Service Role key for reorder writes.

## Consequences

- A failure cannot leave the normalized cart and compatibility snapshot at
  different stages of a reorder operation.
- Reordering twice intentionally adds the quantities twice, preserving the
  user-visible meaning of the action.
- Deleted products and malformed historical product identifiers are skipped and
  reported through `skipped_line_count`; no missing identity is guessed.
- Purchase size, customization, rental dates, and rental quote snapshots are
  retained in normalized cart lines.

## Rollback

Restore the previous Edge Function before running
`supabase/rollback/20260915_reorder_into_normalized_cart.sql`. The rollback only
removes the RPC; it does not delete carts or order data.
