# ADR 0012: Present buyer orders as multi-seller shipments

- Status: Accepted
- Date: 2026-09-21

## Context

The buyer order page displayed one shared order status and one tracking number.
That model cannot represent a marketplace order fulfilled independently by
multiple sellers.

## Decision

1. Load order lines and seller fulfillments in parallel, batched by the visible
   order ids. Load seller profiles once for the resulting seller ids.
2. Build shipment presentation in a pure domain read model, not in the React
   page or database repository.
3. Group each seller's items, status, carrier, service, and tracking information
   into one shipment card.
4. Derive buyer-facing aggregate labels such as `Partially shipped` and
   `Partially delivered` without changing the compatibility `orders.status`.
5. Render one legacy shipment when relational fulfillment data is unavailable.

## Consequences

- Buyers can identify which seller shipped which products.
- One seller's tracking information is never shown as another seller's package.
- Pagination remains constant-query rather than introducing an N+1 request per
  order or seller.
- Existing status filters continue to use the compatibility order status while
  the result card shows the more precise derived status.

## Removal gate

The legacy shipment fallback can be removed after production reconciliation
confirms complete fulfillment coverage for all retained orders.
