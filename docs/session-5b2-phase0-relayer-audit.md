# Session 5B-2 — Phase 0 Task 0.1 — Relayer Audit

Audit of the 5B-1 relayer gap-fill code (12 files). Every finding below is either fixed in this phase or documented as intentional / deferred to a later task.

Files audited:
- `lib/trading/relayer.ts`
- `lib/trading/builtinSigner.ts`
- `lib/trading/notifications.ts`
- `app/api/cron/limit-order-monitor/route.ts`
- `app/api/cron/dca-executor/route.ts`
- `app/api/cron/stop-loss-monitor/route.ts`
- `app/api/cron/copy-trade-monitor/route.ts`
- `app/api/cron/pending-trades-cleanup/route.ts`
- `app/api/trading/pending-trades/route.ts`
- `app/api/trading/pending-trades/[id]/confirm/route.ts`
- `app/api/trading/pending-trades/[id]/reject/route.ts`
- `components/trading/PendingTradesBanner.tsx`
- `supabase/migrations/2026_session5b1_relayer.sql`

---

## Findings

### BUG-1 (HIGH, fixed) — limit-order-monitor does not gate re-trigger on in-flight pending trade

`limit-order-monitor` only marks `limit_orders.status = 'failed'` when security blocks the trade; after a successful pending-trade creation it leaves `status = 'active'`. On the very next cron tick the same row is still `active`, the price is still at the trigger, and a fresh pending_trade row is created. Over 10 minutes of user inaction that becomes 10 duplicate pending trades for the same order.

Fix: when `executeTrade` returns `awaitingUserConfirmation`, set `limit_orders.status = 'pending_confirmation'` with a `pending_trade_id` FK. Re-trigger only from `active`. On confirm, move to `executed`. On reject or pending-trade expiry, a sweeper restores to `active` (see BUG-4 + cleanup expansion).

### BUG-2 (HIGH, fixed) — confirm/route.ts inserts NULL amount_in on DCA executions

`/app/api/trading/pending-trades/[id]/confirm/route.ts` line 57 selects `pending` without `amount_in`, but line 112 reads `(pending as unknown as { amount_in: string }).amount_in` via an unsafe cast to write into `dca_executions.amount_in`. Every DCA execution has been storing `NULL` for `amount_in`.

Fix: add `amount_in` to the select, drop the unsafe cast, use the real column.

### BUG-3 (HIGH, fixed) — stop-loss orders stuck on user reject

`stop-loss-monitor` sets `status = 'triggered_sl' | 'triggered_tp' | 'triggered_trail'` before the user confirms. `reject/route.ts` only restores `user_copy_trades`; stop-loss orders stay frozen in `triggered_*` forever, silently losing the user's stop-loss protection.

Fix: introduce `pending_confirmation` intermediate state. Only promote to `triggered_*` on confirm. On reject or expiry, restore to `active` and clear `triggered_at / triggered_price / realized_pnl_usd`. Same `pending_trade_id` FK pattern as BUG-1.

### BUG-4 (HIGH, fixed) — reject/route.ts does not restore non-copy_trade source orders

`reject/route.ts` only updates `user_copy_trades`. If the user rejects a limit-order or stop-loss pending trade, the source order sits in `pending_confirmation` forever.

Fix: in reject, switch on `source_order_table` and restore status accordingly. In `pending-trades-cleanup`, the same restore must happen when a pending trade expires (user didn't confirm or reject within 10 minutes).

### BUG-5 (HIGH, fixed) — confirm/route.ts trusts client-reported amountOut and executedPrice

Confirm accepts `amountOut` + `executedPrice` from the client and writes them straight into `limit_orders.executed_amount_out / executed_price`. A user can post arbitrary values — the platform then reports false P&L, false averages into DCA aggregates, and false copy-trade outcomes.

Fix: stop writing client-reported amounts. Store only `tx_hash`. The new receipt-reconciliation cron (Task 0.3) parses the actual on-chain receipt and writes authoritative `actual_amount_out / actual_price / actual_gas_usd / actual_slippage_bps`. Client-provided values are accepted but stored in `client_reported_*` columns for later drift analysis only, never as authoritative P&L.

### BUG-6 (MEDIUM, fixed) — pending-trades-cleanup does not restore source orders on expiry

`pending-trades-cleanup` sets expired pending trades to `status = 'expired'` but never touches the source order. Combined with BUG-1/BUG-3, expired pending trades leave source orders stranded in `pending_confirmation`.

Fix: extend cleanup to restore source orders to `active` (limit_orders, stop_loss_orders) or mark `user_copy_trades` as `expired`. DCA bots already advanced their schedule at trigger time so they're self-healing; document that behavior.

### BUG-7 (MEDIUM, by design, documented) — dca-executor advances next_execution_at before user confirmation

If the user rejects a DCA pending trade, that slot is lost — the bot won't retry until the next interval. This is intentional: the user implicitly declined that interval's buy; retry-on-reject would create a loop-trap if the user wants to pause. But it was undocumented. Now documented in the ops runbook.

### BUG-8 (MEDIUM, fixed by Task 0.4) — copy-trade-monitor only processes whale buys

Line 180–183 of `copy-trade-monitor` hard-skips `action === "sell"`. Followers never exit when the whale does. Fixed as part of Task 0.4.

### OBSERVATION-1 — route_data JSONB on Solana is `{}`

`relayer.ts` inserts `{}` for Solana because Jupiter quotes happen at confirm time. Safe (column is `NOT NULL JSONB`, `{}` satisfies the constraint) and intentional. No fix needed.

### OBSERVATION-2 — copy-trade dedupe persists across reject

`copy-trade-monitor` dedupes on `(user_id, source_tx_hash)` across all statuses. If a user rejects, they cannot re-copy the same whale tx later. Intentional — rejecting a copy says "I don't want this one" — but worth surfacing in UI.

### OBSERVATION-3 — copy-trade lookback vs cron cadence

`copy-trade-monitor` has `LOOKBACK_SECONDS = 180`. As long as the cron fires at least every 3 minutes, nothing is missed. `vercel.json` should be verified to schedule it at `*/1 * * * *` or `*/2 * * * *`. Documented in runbook; not a code fix.

### OBSERVATION-4 — pending-trades GET uses anon-key client (RLS enforced)

Correct behavior. User can only see their own pending trades via `users_own_pending_trades` policy. Double-checked: forbidden/404 path in confirm/reject still works because SELECT uses `single()` which 404s when RLS filters the row.

---

## Summary

Fixes applied in this phase:
- BUG-1, BUG-2, BUG-3, BUG-4, BUG-5, BUG-6 — code + schema changes shipped together.
- BUG-7 — documented in runbook (Task 0.5).
- BUG-8 — Task 0.4.
- OBS-1, OBS-2, OBS-3, OBS-4 — documented, no code change.

SQL schema deltas needed (consolidated at end of phase):
1. `limit_orders.pending_trade_id UUID` + new status value `'pending_confirmation'`.
2. `stop_loss_orders.pending_trade_id UUID` + new status value `'pending_confirmation'`.
3. Receipt reconciliation columns on `limit_orders`, `dca_executions`, `stop_loss_orders`, `user_copy_trades` (Task 0.3).
4. Drop the unsafe client-reported writes from `limit_orders.executed_amount_out / executed_price`; keep columns but rename semantics (authoritative values populated by reconciliation cron).
