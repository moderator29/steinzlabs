# Phase 0 — Relayer Ops Runbook

Operational reference for the non-custodial relayer stack. All private keys
live in the user's browser; the platform never signs. Every automated
trigger ends at a pending_trade row the user must confirm within 10 minutes.

## End-to-end flow

```
[Monitor cron fires]
        │
        │  (limit-order-monitor / dca-executor / stop-loss-monitor /
        │   copy-trade-monitor)
        ▼
[relayer.executeTrade]
        │  1. GoPlus security check on toToken (skip for sell path)
        │  2. getAllRoutes from swap-aggregator (EVM) — Solana quotes
        │     happen client-side at confirm time
        │  3. INSERT pending_trades (status='pending', expires_at=NOW+10m)
        │  4. notifyPendingTrade — Telegram + in-app push
        │
        ▼
[Source order moves to 'pending_confirmation']
        │  (limit_orders / stop_loss_orders only; dca_bots advances
        │   next_execution_at instead; user_copy_trades stays 'pending')
        │
        ▼
[User sees PendingTradesBanner]
        │  GET /api/trading/pending-trades  (polled every 20s)
        │
        ▼
[User clicks Confirm] ────────────────────────────────┐
        │                                              │
        │  window.__nakaSignPendingTrade(trade)        │  [User clicks Reject]
        │    → POST /api/trading/pending-trades/[id]/prepare
        │         returns fresh 0x quote for EVM or Jupiter hint for Solana
        │    → sign via MetaMask / Phantom / builtin AES-GCM+ethers
        │    → broadcast                               │
        │                                              ▼
        │                                 POST /api/trading/pending-trades/[id]/reject
        │                                     pending_trades.status = 'rejected'
        │                                     source_order restored:
        │                                       limit_orders → 'active'
        │                                       stop_loss_orders → 'active'
        │                                       user_copy_trades → 'cancelled'
        │                                       dca_bots: no-op (schedule already advanced)
        │
        │  POST /api/trading/pending-trades/[id]/confirm
        │    pending_trades.status = 'confirmed'
        │    source_order moved to executed / triggered_* / success
        │
        ▼
[receipt-reconciliation cron runs every 2m]
        │  Reads rows where tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL
        │  EVM:     Alchemy getTransactionReceipt → parse Transfer logs
        │  Solana:  RPC getTransaction → diff token balances
        │  Writes actual_amount_out / actual_price / actual_gas_usd /
        │           actual_slippage_bps / tx_reverted / revert_reason
        │
        ▼
[User sees actual P&L]

[pending-trades-cleanup cron runs every 5m]
        │  If pending_trades.expires_at passed and status still 'pending':
        │    mark 'expired', restore source orders (limit / stop-loss)
        │    or mark copy_trades 'expired' or leave DCA alone.
```

## Tables involved

- `pending_trades` — confirmation queue. Always start debugging here.
- `limit_orders`, `dca_bots` + `dca_executions`, `stop_loss_orders`,
  `user_copy_trades` — source orders that feed the relayer.
- `cron_execution_log` — every cron run writes a row; check for failures.
- `user_whale_follows`, `user_copy_rules`, `whale_activity` — copy-trade
  inputs.
- `wallet_accounts` — user wallet addresses (used by copy-sell sizing).

## Health check SQL

Run these in Supabase SQL Editor. All should return reasonable numbers
(non-zero if the platform has active users, no giant backlogs).

```sql
-- Pending trades by status (last 24h)
SELECT status, COUNT(*) FROM pending_trades
WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status;

-- Active triggers by type
SELECT status, COUNT(*) FROM limit_orders GROUP BY status;
SELECT status, COUNT(*) FROM stop_loss_orders GROUP BY status;
SELECT status, COUNT(*) FROM dca_bots GROUP BY status;

-- Reconciliation backlog — should trend to 0 between cron ticks
SELECT COUNT(*) FROM limit_orders
WHERE executed_tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;
SELECT COUNT(*) FROM dca_executions
WHERE tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;
SELECT COUNT(*) FROM stop_loss_orders
WHERE triggered_tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;
SELECT COUNT(*) FROM user_copy_trades
WHERE copied_tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;

-- Reverted on-chain trades last 24h — investigate if non-zero
SELECT 'limit_orders' t, id, revert_reason FROM limit_orders
  WHERE tx_reverted = TRUE AND receipt_reconciled_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 'stop_loss_orders', id, revert_reason FROM stop_loss_orders
  WHERE tx_reverted = TRUE AND receipt_reconciled_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 'dca_executions', id, revert_reason FROM dca_executions
  WHERE tx_reverted = TRUE AND receipt_reconciled_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 'user_copy_trades', id, revert_reason FROM user_copy_trades
  WHERE tx_reverted = TRUE AND receipt_reconciled_at > NOW() - INTERVAL '24 hours';

-- Cron health (last 24h)
SELECT cron_name, status, COUNT(*), MAX(started_at) AS last_run
FROM cron_execution_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY cron_name, status ORDER BY cron_name, status;

-- Orphaned source orders stuck in pending_confirmation > 15 min
-- (pending-trades-cleanup restores these; non-zero = cleanup failing)
SELECT 'limit_orders' t, id, updated_at FROM limit_orders
  WHERE status = 'pending_confirmation' AND updated_at < NOW() - INTERVAL '15 minutes'
UNION ALL
SELECT 'stop_loss_orders', id, updated_at FROM stop_loss_orders
  WHERE status = 'pending_confirmation' AND updated_at < NOW() - INTERVAL '15 minutes';
```

## Debugging recipes

### "User confirmed but source order didn't update"

1. Check `pending_trades.status` for the id — should be `'confirmed'`.
2. Check `confirmed_tx_hash` — should be set.
3. Check the source table row. If status didn't advance:
   - Look for a Sentry event tagged `module: "relayer.persist"` or the
     confirm/route handler at the time of confirmation.
   - Verify `source_order_table` + `source_order_id` on the pending_trades
     row actually match an existing row.

### "Pending trade never appeared after trigger"

1. Check `cron_execution_log` — did the monitor cron for that type run
   recently and succeed?
2. Check the source order's `updated_at` — did the monitor see it?
3. Security block: look for Sentry tag `module: "relayer.security"`.
   Output of the GoPlus check can block honeypot tokens.
4. Price issue: `limit-order-monitor` requires `getDexPrice` to return
   non-zero. If DexScreener returns nothing, the order is skipped (not
   failed).

### "tx_hash written but actual_amount_out still null after 10 min"

1. Check `cron_execution_log` for `receipt-reconciliation` — status should
   be `'success'`.
2. If `tx_reverted=true`, the tx failed on-chain. `revert_reason` field
   will say `'tx_reverted'` (EVM) or the serialized Solana error.
3. If the chain isn't supported by Alchemy (Avalanche), the parser logs
   `chain_not_supported`. Add support or route via a different provider.

### "Copy-trade didn't fire when whale bought"

1. `user_whale_follows.copy_mode` must be `'oneclick'`.
2. `user_copy_rules.enabled` must be `true` for that (user, whale, chain).
3. `whale_activity` must contain the tx within `LOOKBACK_SECONDS = 180`.
4. `user_copy_trades.source_tx_hash` dedupe — check if a row already
   exists for this user+tx (even if status=cancelled/failed, it's skipped).

### "Copy-trade didn't fire when whale sold"

1. Only the buy branch ran in 5B-1; sell branch is new in 5B-2 Phase 0.
2. User must have a wallet on the matching chain in `wallet_accounts`.
3. User must currently hold `token_address` on that wallet (checked via
   Alchemy / Alchemy-Solana RPC).
4. If holdings are zero or lookup fails, the cron skips (logged as
   `ruleBlocked`) instead of failing — not an error.

## Intentional non-obvious behaviors (documented to avoid confusion)

- **DCA advances schedule on trigger, not on confirm.** If the user rejects
  a DCA pending trade, that interval is lost. By design — prevents a
  retry loop if the user is pausing without toggling bot status.
- **Copy-trade dedup is across all statuses.** If a user rejects a copy
  once, the same whale tx never re-triggers for them, even after 24h.
- **`route_data` is `{}` for Solana.** Jupiter quotes happen client-side at
  confirm; the server-side route row is EVM-only.
- **Honeypot gate applies to `toToken`, not `fromToken`.** In sell
  direction, `toToken=USDC`, so sells never trip the gate.
- **`actual_*` columns are the only source of truth for P&L.**
  `client_reported_*` columns are stored for drift analysis only —
  never display or aggregate them as authoritative.
