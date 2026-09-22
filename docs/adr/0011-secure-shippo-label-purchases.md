# ADR 0011: Scope Shippo labels to seller fulfillments

- Status: Accepted
- Date: 2026-09-21

## Context

The Shippo Edge Function authorized sellers through a compatibility order item
view and stored every purchased label on the shared `orders` row. In a
multi-seller order, one seller could overwrite another seller's shipping data.
Concurrent purchase requests could also create duplicate external transactions.

## Decision

1. Require a normalized `order_items` row owned by the authenticated seller
   before any Shippo rate or label operation.
2. Reserve a purchase atomically on the seller's `seller_fulfillments` row
   before calling Shippo. A second request cannot reserve the same fulfillment.
3. Persist carrier, service, rate, label, transaction, and tracking data through
   an authenticated database RPC bound to the reservation token.
4. Keep an ambiguous failed purchase reserved for manual review because the
   external provider may have completed the purchase. Release only after an
   explicit provider rejection.
5. Default `SHIPPO_MODE` to `test` and require the API token prefix to match the
   configured mode. Live mode must be enabled explicitly.
6. Trust rate metadata returned by Shippo, not metadata submitted by the browser.

## Consequences

- Different sellers can no longer overwrite each other's labels or tracking.
- Fast repeated clicks cannot create concurrent label purchases for one seller.
- Test tokens generate test labels without a live charge.
- A reservation left after an ambiguous provider or persistence failure requires
  investigation before retrying, prioritizing duplicate-charge prevention.
- Buyer multi-package presentation is implemented by ADR 0012.

## Rollback

`supabase/rollback/20260921_secure_shippo_fulfillment_labels.sql` removes the
reservation RPCs, uniqueness index, and reservation columns. The previous Edge
Function must be deployed before applying that rollback.
