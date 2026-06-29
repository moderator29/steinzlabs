-- Active-trader metrics from Bitquery discovery so the smart-money UI can rank
-- and badge "by volume / active daily traders" (not by holdings).
ALTER TABLE public.whales
  ADD COLUMN IF NOT EXISTS volume_7d_usd numeric,
  ADD COLUMN IF NOT EXISTS active_days_7d integer;

CREATE INDEX IF NOT EXISTS whales_volume_7d_idx
  ON public.whales (volume_7d_usd DESC NULLS LAST) WHERE is_active = true;
