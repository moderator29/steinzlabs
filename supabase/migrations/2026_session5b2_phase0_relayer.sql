-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — SESSION 5B-2 PHASE 0 — Relayer hardening
-- Additive + safe to re-run. Covers:
--   1. pending_confirmation intermediate state for limit_orders +
--      stop_loss_orders (blocks duplicate triggers while user confirms).
--   2. pending_trade_id FK columns so the monitor cron can link the
--      source order to the live pending trade.
--   3. client_reported_* columns on pending_trades / limit_orders /
--      dca_executions for drift analysis (no longer authoritative).
--   4. actual_* / tx_reverted / revert_reason / receipt_reconciled_at
--      columns on the four source tables, populated by the new
--      receipt-reconciliation cron (these are the authoritative values).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. pending_confirmation status on limit_orders ──────────────────
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

-- ── 2. pending_confirmation status on stop_loss_orders ──────────────
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

-- ── 3. client_reported_* drift columns ──────────────────────────────
ALTER TABLE pending_trades
  ADD COLUMN IF NOT EXISTS client_reported_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS client_reported_price NUMERIC;

ALTER TABLE limit_orders
  ADD COLUMN IF NOT EXISTS client_reported_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS client_reported_price NUMERIC;

ALTER TABLE dca_executions
  ADD COLUMN IF NOT EXISTS client_reported_amount_out NUMERIC,
  ADD COLUMN IF NOT EXISTS client_reported_price NUMERIC;

-- ── 4. Authoritative on-chain receipt columns ───────────────────────
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

-- ── 5. user_copy_trades status includes 'expired' (cleanup path) ────
ALTER TABLE user_copy_trades DROP CONSTRAINT IF EXISTS user_copy_trades_status_check;
ALTER TABLE user_copy_trades ADD CONSTRAINT user_copy_trades_status_check
  CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'expired'));

-- Action can now be 'sell' (full-exit when followed whale sells).
ALTER TABLE user_copy_trades DROP CONSTRAINT IF EXISTS user_copy_trades_action_check;
ALTER TABLE user_copy_trades ADD CONSTRAINT user_copy_trades_action_check
  CHECK (action IN ('buy', 'sell'));
ALTER TABLE user_copy_trades ALTER COLUMN amount_usd DROP NOT NULL;

-- ── 6. Reconciliation indexes ───────────────────────────────────────
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
