# ADR 0001: Canonical user identity and marketplace roles

- Status: Accepted
- Date: 2026-09-08

## Context

The application currently spreads user identity across `auth.users`, `public.users`,
`public.profiles`, browser storage, and ownership columns. Buyer and seller intent is
not persisted as a first-class model. Existing order readers must also support both
the legacy text `orders.user_id` and the UUID `orders.buyer_id`.

## Decision

1. `auth.users.id` is the only canonical identity identifier.
2. `public.profiles` contains public application and storefront profile data.
3. `public.user_roles` contains additive `buyer`, `seller`, and non-self-service
   `platform_admin` capabilities. A user may hold multiple roles.
4. Every registered user receives an immediately active buyer capability. Seller
   onboarding state never disables or delays that buyer capability.
5. `public.seller_accounts` owns seller lifecycle state: `active` or `suspended`.
   Seller authorization will eventually require an active account.
6. Existing inventory owners are backfilled as active sellers to preserve behavior.
7. Seller registration is open, so new seller accounts become active immediately.
   Suspension remains a trusted platform-admin or server operation.
8. `public.users` and `orders.user_id` remain temporary compatibility surfaces until
   the application and Edge Functions have migrated.
9. Multi-seller orders are supported. A later additive migration will normalize
   `orders.items` into `order_items` and seller-specific fulfillment records.

## Security boundaries

- Editable Auth user metadata is not an authorization source.
- Browser callers cannot directly insert or update role and seller-account rows.
- Self-service seller registration is exposed only through a narrowly scoped function.
- Platform-admin roles are never self-service.
- RLS and explicit grants protect every new public table.

## Rollout

Use an expand-migrate-contract rollout:

1. Expand identity tables, indexes, sync trigger, and compatibility constraints.
2. Audit and backfill identities and roles with deterministic rules.
3. Update seller onboarding and application repositories.
4. Enforce active-seller authorization only after application compatibility tests pass.
5. Normalize order items and migrate Edge Function reads with dual-read verification.
6. Validate deferred constraints, then remove legacy columns in a later release.

## Consequences

- The schema temporarily contains compatibility duplication.
- Existing behavior is preserved while new data stops drifting away from Auth IDs.
- Seller activation and suspension become explicit and auditable.
- Authorization can be enforced consistently in RLS and Edge Functions after the code
  migration, without parsing editable metadata or trusting route parameters.
