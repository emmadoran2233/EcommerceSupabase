# ADR 0002: Separate platform administration from the seller portal

- Status: Accepted
- Date: 2026-09-08

## Context

The repository's `admin` frontend is a seller portal: users manage their own listings,
store profile, order lines, and shipping. It must not imply authority over other sellers
or platform-wide resources.

## Decision

1. `seller` and `platform_admin` are separate additive roles.
2. Seller registration is open and immediately active. A platform administrator may
   suspend or reactivate a seller, but cannot be self-assigned from a browser.
3. Platform-wide mutations use narrowly scoped database or Edge Function operations.
4. Seller lifecycle changes are atomic with append-only audit records.
5. Global banner writes belong to platform administrators. Seller-specific promotional
   content will use a future seller-owned table instead of the global banner table.
6. The current `admin` application remains a seller portal. A separately protected
   platform-admin interface will be added only after the database boundary is verified.

## Consequences

- Existing sellers stay active.
- Seller routes cannot become platform-admin routes merely through URL parameters or
  local storage values.
- No browser role can directly forge an admin audit entry.
- The current seller BannerControl screen must be removed or moved when these policies
  are deployed, because sellers will no longer be allowed to mutate global banners.

