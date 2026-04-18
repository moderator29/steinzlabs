# Phase 0 — Complete

All 6 tasks shipped to `session-5b2-production`. Summary:

| Task | Description | Commit |
| --- | --- | --- |
| 0.1 | Relayer audit + 6 bug fixes | `eff8154` |
| 0.2 | Inline wallet signing + PendingTradesBanner | `0ce76c0` |
| 0.3 | Receipt reconciliation cron + schema | `b4e04cd` |
| 0.4 | Copy-trade sell direction | `edf2ead` |
| 0.5 | Relayer ops runbook | `5b5521f` |
| 0.6 | Admin RelayerHealthCard | (this commit) |

## Consolidated Phase 0 SQL

Run this block in Supabase SQL Editor. Additive + idempotent — safe to re-run.

```sql
-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — SESSION 5B-2 PHASE 0 — Relayer hardening
-- ═══════════════════════════════════════════════════════════════

-- 1. limit_orders: pending_confirmation status + FK to pending_trades
ALTER TABLE limit_orders DROP CONSTRAINT IF EXISTS limit_orders_status_check;
ALTER TABLE limit_orders ADD CONSTRAINT limit_orders_status_check
  CHECK (status IN (
    'active', 'pending_confirmation', 'executed', 'cancelled',
    'expired', 'failed'
  ));
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS pending_trade_id UUID
  REFERENCES pending_trades(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS limit_orders_pending_trade_idx
  ON limit_orders(pending_trade_id) WHERE pending_trade_id IS NOT NULL;

-- 2. stop_loss_orders: same treatment
ALTER TABLE stop_loss_orders DROP CONSTRAINT IF EXISTS stop_loss_orders_status_check;
ALTER TABLE stop_loss_orders ADD CONSTRAINT stop_loss_orders_status_check
  CHECK (status IN (
    'active', 'pending_confirmation', 'triggered_sl', 'triggered_tp',
    'triggered_trail', 'cancelled', 'expired', 'failed'
  ));
ALTER TABLE stop_loss_orders ADD COLUMN IF NOT EXISTS pending_trade_id UUID
  REFERENCES pending_trades(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stop_loss_pending_trade_idx
  ON stop_loss_orders(pending_trade_id) WHERE pending_trade_id IS NOT NULL;

-- 3. Client-reported drift columns (never authoritative)
ALTER TABLE pending_trades
  ADD COLUMN IF NOT EXISTS client_reported_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS client_reported_price NUMERIC;
ALTER TABLE limit_orders
  ADD COLUMN IF NOT EXISTS client_reported_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS client_reported_price NUMERIC;
ALTER TABLE dca_executions
  ADD COLUMN IF NOT EXISTS client_reported_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS client_reported_price NUMERIC;

-- 4. Authoritative receipt-reconciliation columns
ALTER TABLE limit_orders
  ADD COLUMN IF NOT EXISTS actual_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_price NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_gas_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_slippage_bps INTEGER,
  ADD COLUMN IF NOT EXISTS tx_reverted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revert_reason TEXT,
  ADD COLUMN IF NOT EXISTS receipt_reconciled_at TIMESTAMPTZ;
ALTER TABLE dca_executions
  ADD COLUMN IF NOT EXISTS actual_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_price NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_gas_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_slippage_bps INTEGER,
  ADD COLUMN IF NOT EXISTS tx_reverted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revert_reason TEXT,
  ADD COLUMN IF NOT EXISTS receipt_reconciled_at TIMESTAMPTZ;
ALTER TABLE stop_loss_orders
  ADD COLUMN IF NOT EXISTS actual_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_price NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_gas_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_slippage_bps INTEGER,
  ADD COLUMN IF NOT EXISTS tx_reverted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revert_reason TEXT,
  ADD COLUMN IF NOT EXISTS receipt_reconciled_at TIMESTAMPTZ;
ALTER TABLE user_copy_trades
  ADD COLUMN IF NOT EXISTS actual_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_price NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_gas_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_slippage_bps INTEGER,
  ADD COLUMN IF NOT EXISTS tx_reverted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revert_reason TEXT,
  ADD COLUMN IF NOT EXISTS receipt_reconciled_at TIMESTAMPTZ;

-- 5. user_copy_trades: status adds 'expired', action includes 'sell',
--    amount_usd nullable for sell rows
ALTER TABLE user_copy_trades DROP CONSTRAINT IF EXISTS user_copy_trades_status_check;
ALTER TABLE user_copy_trades ADD CONSTRAINT user_copy_trades_status_check
  CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'expired'));
ALTER TABLE user_copy_trades DROP CONSTRAINT IF EXISTS user_copy_trades_action_check;
ALTER TABLE user_copy_trades ADD CONSTRAINT user_copy_trades_action_check
  CHECK (action IN ('buy', 'sell'));
ALTER TABLE user_copy_trades ALTER COLUMN amount_usd DROP NOT NULL;

-- 6. Reconciliation-targeted partial indexes
CREATE INDEX IF NOT EXISTS limit_orders_reconcile_idx
  ON limit_orders(receipt_reconciled_at)
  WHERE executed_tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;
CREATE INDEX IF NOT EXISTS dca_executions_reconcile_idx
  ON dca_executions(receipt_reconciled_at)
  WHERE tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;
CREATE INDEX IF NOT EXISTS stop_loss_reconcile_idx
  ON stop_loss_orders(receipt_reconciled_at)
  WHERE triggered_tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;
CREATE INDEX IF NOT EXISTS copy_trades_reconcile_idx
  ON user_copy_trades(receipt_reconciled_at)
  WHERE copied_tx_hash IS NOT NULL AND receipt_reconciled_at IS NULL;
```

## New cron added

`/api/cron/receipt-reconciliation` — schedule `*/2 * * * *` (registered
in `vercel.json`).

## What ships in Phase 0

- Non-custodial relayer cleaned up: no duplicate triggers, no stranded
  source orders on reject/expiry, no client-trusted P&L.
- Users confirm pending trades inline from any dashboard page — no
  navigation, no lost context.
- Authoritative execution amounts come from on-chain receipts only.
- Copy-trading mirrors whale exits, not just entries.
- Admin has a live health card: statuses, cron success rates,
  reconciliation backlog, recent reverts.

## Pending for the next phase(s)

Per the Session 5B-2 master prompt, Phases 1-8 of Batch 1 still to run
(individually, per the revised execution pattern):

1. Crypto payments (USDC/SOL/ETH to treasury with tier upgrade)
2. 2FA (TOTP + recovery codes + trusted devices)
3. Settings institutional rebuild
4. GoPlus branding removal (silent infrastructure)
5. VTX backend rewrite (Sonnet 4.6 + 8 tools)
6. VTX inline card system (7 card types)
7. VTX 3-column institutional UI
8. VTX overview / preview flow + session sharing
