# Legacy commerce contract removal gates

Legacy fields are removed only after normalized data is reconciled in production
and every reader and writer has moved. A zero-count database report is necessary
but not sufficient; application and Edge Function references must also be zero.

Run the read-only report:

```bash
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 \
  --file supabase/verification/20260921181000_legacy_contract_readiness.sql
```

## Current gates

| Legacy structure | Canonical replacement | Remaining gate before removal |
| --- | --- | --- |
| `orders.items` | `order_items` | Remove normalized-first fallback readers and prove line-count and money reconciliation. |
| `carts.items` | `cart_items` | Storefront writes now use `set_normalized_cart_line`; migrate reorder and fallback reads, observe production, then remove the deprecated `set_cart_line(..., p_legacy_items)` overload. |
| Shared shipping fields on `orders` | `seller_fulfillments` | Backfill every `(order_id, seller_id)` and remove email/UI fallbacks. |
| `orders.user_id` | `orders.buyer_id` | Resolve every missing buyer, update all policies/functions, then enforce `buyer_id not null`. |
| `orders.order_id` | `orders.order_number` plus provider-specific payment fields | Inventory provider references and move every public lookup to `order_number`. |
| `public.users` | `auth.users`, `profiles`, and `carts` | Move the final compatibility reads and validate identity foreign keys. |

## Release sequence

1. Deploy additive migrations and compatible readers.
2. Run idempotent backfill in staging, then production.
   Run `backfill_relational_data()` first and
   `backfill_missing_seller_fulfillments()` second.
3. Save the reconciliation output with the release evidence.
4. Stop all legacy writes and observe at least one normal release window.
5. Remove fallback reads.
6. Validate deferred constraints and make required canonical fields non-null.
7. Drop legacy columns/tables in a separate reversible contract release.

Payment rows are currently test-mode evidence. Missing `order_payments` rows are
reported, not automatically created, because inventing payment history would be
unsafe.
