# Remote data audit — 2026-09-08

Project: `Ecommerce Template Project` (`vhbgepmpesopzpmzmcjs`)

The audit was executed in the Supabase SQL Editor using count-only queries. No
email address, UUID, profile content, or row payload was exported.

## Identity findings

| Check | Count | Decision |
|---|---:|---|
| Auth users | 14 | Canonical identity population |
| Public users without Auth identity | 1 | Repair only through its unique Auth email match |
| Auth users without public user row | 10 | Insert compatibility rows from Auth |
| Auth users without profile | 4 | Insert missing profiles without overwriting existing data |
| Public email mapped to the wrong id | 1 | Same deterministic repair candidate as the orphan row |
| Orders without `buyer_id` | 3 | Do not guess |
| Missing-buyer orders with exact legacy Auth match | 0 | No automatic order buyer repair is currently possible |
| Orders with unmatched non-null legacy `user_id` | 0 | The three missing buyers have no usable legacy identifier |
| Products without seller id | 2 | Do not guess |
| Reviews without user id | 3 | Do not guess |

## Relational conversion findings

| Check | Count | Decision |
|---|---:|---|
| Total legacy order item lines | 134 | Source population |
| Product references not found | 2 | Preserve JSON snapshot; leave normalized FK null |
| Seller ids not found in Auth | 0 | No invalid non-null Auth seller ids detected |
| Lines without seller or product fallback | 8 | Leave seller null for manual reconciliation |
| Invalid quantities | 0 | Quantities are convertible |
| Invalid/missing amounts | 2 | Skip these lines; do not fabricate money values |
| Orders containing multiple sellers | 8 | Do not copy an order-level shipment to every seller |
| Legacy item lines without seller id | 8 | Reconcile manually where product ownership cannot supply it |
| Object-format carts | 5 | Supported by the backfill |
| Array-format carts | 0 | Compatibility remains tested but is not present remotely |
| Other cart formats | 0 | No unsupported cart container type detected |

## Payment annotation

| Check | Count | Decision |
|---|---:|---|
| Legacy orders marked paid | 21 | Do not infer production payment truth |
| Paid orders with a Stripe reference | 20 | Retain legacy references; no automatic payment-row backfill |

The project may only be using provider test mode. Payment rows will be migrated
after the payment environment and provider event semantics are confirmed.

## Safe automatic backfill

`backfill_relational_data()` may safely:

1. repair the one orphan public user id through its unique Auth email match;
2. add missing public-user and profile compatibility rows;
3. assign buyer roles to Auth identities;
4. infer active sellers only from existing inventory ownership;
5. normalize order lines with valid quantities and money values;
6. create fulfillment only for orders with exactly one known seller; and
7. normalize recognized cart lines.

It intentionally does not assign the three missing order buyers, two missing
product sellers, three review authors, eight unresolved item sellers, or any payment
status.
