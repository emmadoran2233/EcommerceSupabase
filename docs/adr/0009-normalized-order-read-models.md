# ADR 0009: Use normalized order read models in buyer and seller applications

- Status: Accepted
- Date: 2026-09-15

## Context

Buyer and seller order pages queried `orders` directly and rendered the legacy
`orders.items` JSON. Seller visibility policies also trusted `seller_id` values
inside that client-shaped JSON, even though normalized order creation derives
seller ownership from the product catalog.

## Decision

1. Keep data access in application-specific order repositories and keep
   normalization/fallback decisions in pure domain read-model functions.
2. Load buyer order headers and normalized lines in two batched queries so
   pagination counts remain correct without creating an N+1 query pattern.
3. Load seller orders and seller-visible relational lines through one embedded
   PostgREST relationship query.
4. Prefer complete normalized lines and fall back to legacy JSON only for
   incomplete historical data or a failed compatibility read.
5. Authorize seller access through the security-definer
   `seller_can_access_order` helper. Complete normalized ownership overrides a
   conflicting seller id in legacy JSON.
6. Retain the existing seller update capability during this behavior-preserving
   phase. Moving status and shipping writes to `seller_fulfillments` is a
   separate contract change.

## Consequences

- UI components no longer own database query and normalization details.
- Buyer pagination performs a constant two database requests per page.
- Seller order visibility uses catalog-derived relational ownership for all
  complete normalized orders.
- Old orders remain visible when deterministic backfill could not complete
  every line.

## Removal gate

The legacy fallback and `orders.items` cannot be removed until production
reconciliation reports complete line coverage and payment functions have moved
to a server-authoritative normalized pricing contract.
