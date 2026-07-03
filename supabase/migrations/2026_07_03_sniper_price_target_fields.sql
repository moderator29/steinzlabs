-- price_target sniper triggers stored only the target number — no token to
-- watch and no direction — so the cron had nothing to evaluate. Add columns.
ALTER TABLE public.sniper_criteria ADD COLUMN IF NOT EXISTS trigger_token_address text;
ALTER TABLE public.sniper_criteria ADD COLUMN IF NOT EXISTS trigger_price_direction text
  CHECK (trigger_price_direction IN ('above','below'));
