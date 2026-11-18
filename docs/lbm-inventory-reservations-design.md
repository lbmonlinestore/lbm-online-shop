# LBM Inventory Reservations — Implementation Draft

**Status:** Design draft only. Not applied to Supabase. Not production-ready.
**Base:** Bank Transfer integration branch `feature/lbm-bank-transfer-secure`.

## Confirmed business rules

### Bank Transfer
- Reserve stock atomically when the Bank Transfer order is created.
- Reservation expires 24 hours after order creation.
- A receipt submitted before expiry keeps the reservation while the admin verifies it.
- A rejected receipt may be corrected only while the original 24-hour deadline remains.
- If no receipt is submitted by expiry, expire the order and release its reservation.
- When admin approves a valid payment, decrement physical stock exactly once and mark the reservation consumed.
- A payment arriving after expiry must not be auto-confirmed; admin must check current stock and resolve it manually.

### Lay-Bay
- Creating a plan does not reserve stock.
- Reserve stock only when the first deposit is approved and is at least 50% of the plan's locked Lay-Bay price.
- Reservation deadline is 30 days from the first approved deposit.
- An approved extension may move the operational expiry only within the absolute 30-day maximum already intended by the policy; extension logic must be reconciled with this rule before deployment.
- Expiry or approved cancellation releases an active reservation.
- Completing payment/fulfilment consumes the reservation and decrements physical stock exactly once.
- Existing plans and deposits must not be retroactively reserved or have balances rewritten without a separate reconciliation decision.

## Inventory model

Keep physical stock separate from reserved stock:
- `products.stock` remains physical on-hand stock.
- Available-to-promise stock = physical stock minus active reservations.
- Reservations are product-level because the current catalog has product-level stock only; sizes/colours are validated selections, not separately stocked variants.
- Never decrement `products.stock` when creating a reservation.
- Decrement physical stock only when a reservation is consumed.

Proposed table: `public.lbm_inventory_reservations`
- `id` UUID primary key.
- Exactly one source: `order_id` OR `lay_bay_plan_id`.
- `product_id` FK to `products(id)`.
- `quantity` positive integer.
- `status`: `active`, `consumed`, `released`.
- `reserved_at`, `expires_at`, `consumed_at`, `released_at`.
- Unique source/product constraint to make retries idempotent.
- Partial index for active reservations by product and expiry.
- RLS enabled; no direct customer writes. Mutations only through narrowly scoped server-side RPCs.

## Required transaction guarantees

1. Lock product rows in ascending product ID order to avoid deadlocks.
2. Under the lock, calculate active reserved quantity and reject if requested quantity exceeds `stock - reserved`.
3. Create the order/plan reservation in the same transaction as its triggering event.
4. Consume/release with conditional status transitions (`WHERE status = 'active'`) so repeated calls cannot decrement or release twice.
5. On consumption, verify the reservation is active and physical stock is sufficient, decrement stock once, then mark consumed in the same transaction.
6. Expiry worker uses `FOR UPDATE SKIP LOCKED`, checks the source status/deadline, releases only still-active reservations, and is safe to run repeatedly.
7. Payment approval, order status, reservation consumption, and stock decrement must be atomic.

## Required RPC changes

### Bank Transfer
- `create_lbm_bank_transfer_order`: aggregate duplicate cart lines by product; reserve each product quantity atomically; set a 24-hour order payment deadline. Fail the entire order if any product is unavailable.
- `submit_lbm_bank_transfer`: reject expired orders even if a stale client submits.
- `review_lbm_bank_transfer`: on approval, require a live reservation and consume it once; on rejection keep reservation only until original deadline.
- Expiry worker: expire unpaid Bank Transfer orders at deadline and release their active reservations. Submitted receipts remain reserved only until the same deadline; no silent extension.

### Lay-Bay
- `review_lay_bay_deposit`: only after the first qualifying approved deposit, reserve the product and set first-deposit deadline to 30 days. The reservation and ledger credit must commit atomically.
- `expire_lay_bay_plans`: expire eligible plans and release reservations in the same transaction.
- Fulfilment/cancellation paths: consume/release reservations exactly once.
- Reconcile the current 45-day assignment in deposit approval with the 30-day extension function before enabling the change.

## Existing data safeguards

- Do not backfill active reservations for historical Bank Transfer orders or Lay-Bay plans automatically.
- Do not rewrite existing approved deposits, ledger balances, receipts, or refunds.
- The inspected Lay-Bay records include active plans with no first deposit and a historical approved K10 deposit below today's 50% threshold. Preserve these records pending an explicit reconciliation policy.
- Current product-level stock does not support independent size/colour stock counts.

## Verification plan (must pass before merge)

- Two concurrent orders competing for the final unit: only one succeeds.
- Duplicate product lines in one cart reserve the summed quantity, not each line independently.
- Duplicate RPC retry cannot create duplicate reservation or order.
- Bank Transfer receipt submitted before deadline retains reservation; after deadline is rejected.
- Rejected receipt can be replaced before deadline, but not after.
- Approval consumes reservation and decrements stock exactly once, including repeated admin clicks.
- Expiry releases stock exactly once and marks the order expired.
- Lay-Bay plan creation reserves nothing.
- First approved deposit below 50% is rejected without ledger credit or reservation.
- First approved deposit at/above 50% creates exactly one 30-day reservation.
- Lay-Bay expiry/cancellation releases stock; completion consumes it once.
- Existing historical balances and plans remain unchanged.
- RLS and grants prevent customer direct writes to reservation rows.

## Deployment gate

This draft is not executable migration SQL. It must be translated into a reviewed migration against the exact current function definitions, then tested in a disposable database. No production SQL, scheduled-job changes, or PR merge is authorized by this document.
