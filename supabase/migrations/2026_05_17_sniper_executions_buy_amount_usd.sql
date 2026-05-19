-- Add USD-denominated amount column to sniper_executions for the safety-gate route
-- (app/api/sniper/execute) which caps snipes at $500 USD. The existing amount_native
-- + amount_sol columns are for the auto-execute relayer rail (chain-native units).
-- Additive only; safe to re-run.
ALTER TABLE public.sniper_executions
  ADD COLUMN IF NOT EXISTS buy_amount_usd numeric;

CREATE INDEX IF NOT EXISTS idx_sniper_executions_user_executed
  ON public.sniper_executions(user_id, executed_at DESC);
