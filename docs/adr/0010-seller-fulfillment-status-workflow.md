# ADR 0010: Store seller shipping progress per fulfillment

- Status: Accepted
- Date: 2026-09-15

## Context

A marketplace order can contain products from multiple sellers. Allowing each
seller to update the shared `orders` row makes one seller capable of overwriting
another seller's status and tracking information.

## Decision

1. Store each seller's status and manual tracking information in the matching
   `seller_fulfillments` row.
2. Perform updates through the security-definer `update_seller_fulfillment`
   function. It uses `auth.uid()` and verifies normalized order ownership.
3. Remove the seller policy that permitted direct updates to `orders`.
4. Derive `orders.status` as a temporary aggregate compatibility value for
   existing readers and email workflows.
5. Mirror tracking onto the legacy order header only for single-seller orders.
6. Keep historical order-level fields as read fallbacks during the expand and
   contract rollout.

## Consequences

- Sellers cannot overwrite another seller's fulfillment state.
- Multi-seller orders can retain separate tracking numbers and links.
- Existing consumers can continue reading the aggregate order status while
  they migrate to fulfillment-aware views.
- Shippo label purchase remains a separate external side-effect migration. Its
  current behavior is not changed by this decision.

## Rollback

`supabase/rollback/20260915_seller_fulfillment_workflow.sql` removes the RPC,
restores the previous status constraint, and restores the former update policy.
