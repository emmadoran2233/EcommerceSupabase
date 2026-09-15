# Database schema rollout

## Source of truth

- `auth.users`: authentication identity
- `profiles`: public profile/store presentation
- `user_roles`: buyer, seller, and platform-admin capabilities
- `seller_accounts`: active or suspended seller lifecycle

## Transaction model

- `orders`: buyer-level order
- `order_items`: normalized immutable lines
- `seller_fulfillments`: per-seller fulfillment
- `order_payments`: provider-neutral payment lifecycle
- `carts` and `cart_items`: normalized cart ownership and lines

## Migration gates

Every public business table must have a primary key. Foreign-key ownership paths
must have supporting indexes before traffic is moved to the normalized tables.

1. Apply schema expansion in a staging or preview environment.
2. Bootstrap the first platform administrator using the reviewed out-of-band runbook.
3. Run pgTAP tests and both verification SQL files.
4. Resolve ambiguous identities without guessing.
5. Run `backfill_relational_data()` to backfill only deterministic identities,
   order lines, single-seller fulfillment, and recognized cart lines.
6. Compare row counts, seller ownership, money totals, and rental dates.
7. Add dual-read application code and Edge Function contract tests.
8. Switch reads, observe production, and only then validate deferred constraints.
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
