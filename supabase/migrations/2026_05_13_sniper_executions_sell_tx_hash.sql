-- Audit trail for sniper auto-sell completions.
--
-- Before this migration, recovering "what tx settled this position" required
-- joining sniper_executions → pending_trades → confirmed_tx_hash. The hash is
-- canonical enough to live alongside realized_at directly so the autosell UI
-- and receipt-reconciliation cron can pull it in one read.

ALTER TABLE sniper_executions
  ADD COLUMN IF NOT EXISTS sell_tx_hash text;

CREATE INDEX IF NOT EXISTS sniper_executions_sell_tx_hash_idx
  ON sniper_executions (sell_tx_hash)
  WHERE sell_tx_hash IS NOT NULL;
