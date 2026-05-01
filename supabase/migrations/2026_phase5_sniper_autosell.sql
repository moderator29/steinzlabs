-- Phase 5 (auto-sell engine) — sniper_executions extensions.
-- Idempotent: safe to re-run.

ALTER TABLE public.sniper_executions
  ADD COLUMN IF NOT EXISTS entry_price_usd numeric,
  ADD COLUMN IF NOT EXISTS tokens_received numeric,
  ADD COLUMN IF NOT EXISTS peak_price_usd numeric,
  ADD COLUMN IF NOT EXISTS sell_pending_trade_id uuid,
  ADD COLUMN IF NOT EXISTS sell_dispatched_at timestamptz;

-- Hot-path index for the auto-sell cron: scans only open positions.
CREATE INDEX IF NOT EXISTS idx_sniper_exec_open
  ON public.sniper_executions (status, realized_at)
  WHERE status = 'confirmed' AND realized_at IS NULL;
