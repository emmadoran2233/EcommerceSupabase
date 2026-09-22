# Database schema rollout

## Source of truth

- `auth.users`: authentication identity
- `profiles`: public profile/store presentation
- `user_roles`: buyer, seller, and platform-admin capabilities
- `seller_accounts`: active or suspended seller lifecycle

## Transaction model

- `orders`: buyer-level order
- `orders.order_number`: immutable public reference (`UTC timestamp-short id-integer`)
- `order_items`: normalized immutable lines
- `seller_fulfillments`: per-seller fulfillment
- `order_payments`: provider-neutral payment lifecycle
- `carts` and `cart_items`: normalized cart ownership and lines

## Migration gates

Every public business table must have a primary key. Foreign-key ownership paths
must have supporting indexes before traffic is moved to the normalized tables.

1. Apply schema expansion in a staging or preview environment.
2. Bootstrap the first platform administrator using the reviewed out-of-band runbook.
3. Run pgTAP tests and all verification SQL files, including the legacy-contract
   readiness report.
4. Resolve ambiguous identities without guessing.
5. Run `backfill_relational_data()` to backfill only deterministic identities,
   order lines, single-seller fulfillment, and recognized cart lines. Then run
   `backfill_missing_seller_fulfillments()` to create a pending aggregate for
   every remaining normalized order/seller pair without copying ambiguous
   shared tracking data.
6. Compare row counts, seller ownership, money totals, and rental dates.
7. Add dual-read application code and Edge Function contract tests. Email and
   Shippo authorization now use the shared normalized-first adapter, and
   reorder writes normalized carts atomically. Buyer and seller order pages now
   use normalized read models. Seller manual status and tracking writes now use
   per-seller fulfillments through ownership-checked RPCs. Shippo labels now use
   normalized seller ownership, per-fulfillment persistence, and an atomic
   purchase reservation. Buyer order history now presents independent seller
   shipments with batched reads. Payment and future platform-admin order
   screens remain migration targets.
8. Switch all remaining reads, observe production, and only then validate
   deferred constraints.
9. Remove legacy columns in a separate contract release.

## Deferred cleanup

The following changes require verified data and are intentionally not forced yet:

- Validate `public.users.id` and other `NOT VALID` foreign keys.
- Make canonical identity and ownership fields `NOT NULL` where business rules require it.
- Deduplicate request likes, then add `unique (request_id, user_id)`.
- Resolve case-insensitive subscriber duplicates before adding a normalized-email unique key.
- Remove `reviews.product_id` after all readers use `reviews.product_uuid`.
- Remove JSON cart and order items after normalized dual-read verification.
- Move global BannerControl out of the seller portal.
- Remove `orders.order_id` only after all public and provider references use
  `orders.order_number` or a provider-specific field.

The exact contract-removal gates and release order are documented in
[`legacy-contract-removal.md`](./legacy-contract-removal.md).
