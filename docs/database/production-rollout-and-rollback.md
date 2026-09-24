# Production rollout and rollback — 2026-09-08

Project: `Ecommerce Template Project` (`vhbgepmpesopzpmzmcjs`), main production.

## Deployment result

- Status: deployed and verified on 2026-09-08.
- Remote and local migration histories match through `20260908160000`.
- Production database lint reported no schema errors.
- All 21 required application tables have RLS enabled.
- No public table is missing a primary key.
- Anonymous storefront product browsing passed with no browser warnings or errors.
- The seller portal login entry loaded with no browser warnings or errors.
- All 29 required anon, authenticated, and service-role table privileges are present.
- Authenticated callers cannot invoke the backfill; service-role access is present.
- Local final verification passed 95 pgTAP assertions.

The first push applied migrations through `20260908153000`, then stopped before the
data backfill because the historical remote schema lacked
`orders.shipping_transaction_id`. No partial backfill was committed. Migration
`20260908155000_ensure_order_shipping_compatibility.sql` was added and verified, then
the forward-fix and idempotent backfill completed successfully.

### Post-deployment row reconciliation

| Check | Result |
|---|---:|
| Auth users / public users / profiles / buyer roles | 14 / 14 / 14 / 14 |
| Seller roles / active seller accounts | 5 / 5 |
| Normalized order items | 132 |
| Seller fulfillment rows | 47 |
| Normalized cart items | 6 |
| Normalized payment rows | 0 |
| Legacy orders with items / normalized orders | 56 / 55 |
| Legacy carts with items / normalized carts | 5 / 4 |
| Single-seller orders missing fulfillment | 0 |

One order and one cart remain legacy-only because their contents cannot be converted
without inventing product, money, or ownership data. All 21 legacy paid orders remain
without normalized payment rows by design because provider test/production semantics
have not been confirmed.

## Pre-deployment artifacts

The following files must exist locally before `supabase db push`:

- `backups/20260908-before-schema-refactor/schema.sql`
- `backups/20260908-before-schema-refactor/public-data.sql`
- `backups/20260908-before-schema-refactor/migration-list.txt`

`backups/` is gitignored because the data dump can contain personal and business
data. Restrict the files to the local user and never attach them to a PR.

Backup file SHA-256 checksums:

```text
5b896b5bf9b608f5252943287a2043e836dd65fbbc1b7fb7e2fe57c41f9fd70f  schema.sql
d9c1b8cf0c3a9a3b42eb1508713788497058da7c6bf96d8420bfd91a925d88bb  public-data.sql
5c05f1831eda62a37b06ac81cc5a5fcfd948d5a6152b0923de9d31ec838f55e3  migration-list.txt
```

## Deployment

1. Confirm the remote migration list still ends at `20260614160000`.
2. Create the schema and public-data backups.
3. Run the eight pending migrations in timestamp order.
4. Run all count-only verification SQL.
5. Verify RLS, buyer order reads, seller inventory writes, checkout order inserts,
   email-event service writes, and global Banner access.
6. Do not validate deferred constraints until ambiguous data is resolved.

## Rollback level 1: application compatibility

Use this when checkout, seller inventory, or the current seller portal fails but the
database migration itself completed.

1. Keep application readers on legacy `orders.items`, `orders.user_id`, and
   `carts.items`.
2. Deploy `supabase/rollback/20260908_restore_legacy_compatibility.sql` through a
   reviewed SQL Editor session if the seller portal must regain global BannerControl.
3. Keep the additive tables and backfilled data. They are not used by current readers
   and dropping them would make recovery riskier.
4. Capture the failure and use a forward migration to correct RLS or grants.

## Rollback level 2: schema recovery

Use the pre-deployment `schema.sql` as the source of truth for the exact previous RLS,
grants, functions, triggers, and constraints. Restore into an isolated database first
and compare it with production. Do not blindly execute the complete schema dump over
a live production database.

## Rollback level 3: data recovery

The migration is additive, but it updates one deterministic legacy `public.users.id`
and inserts compatibility/backfill rows. Exact reversal requires the pre-deployment
`public-data.sql` or a managed database backup.

Restoring the full data dump is destructive and must be separately approved. Prefer a
targeted repair or forward migration unless production data is demonstrably corrupted.

## Known non-blocking exceptions

- Three orders have neither a usable legacy user id nor a buyer id.
- Two products have no seller id.
- Three reviews have no user id.
- Eight legacy order lines cannot resolve a seller.
- Two order lines have an invalid or missing amount and will be skipped.
- Payment rows are not backfilled because the current provider may be in test mode.

These rows are preserved for manual reconciliation; deployment must not invent their
identity, ownership, money, or payment state.
