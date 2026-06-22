-- NakaCult Commons — automation inputs.
--
-- Conviction scoring: capture the entry price + the DEX pair to re-price
-- against, and when the call becomes eligible to score. Signal feeder: a
-- dedup_key so the consensus feeder can insert idempotently (no duplicate
-- signals for the same convergence). Idempotent.

ALTER TABLE cult_convictions ADD COLUMN IF NOT EXISTS entry_price_usd numeric;
ALTER TABLE cult_convictions ADD COLUMN IF NOT EXISTS pair_ref        text;
ALTER TABLE cult_convictions ADD COLUMN IF NOT EXISTS pair_chain      text;
ALTER TABLE cult_convictions ADD COLUMN IF NOT EXISTS resolve_at      timestamptz;

ALTER TABLE cult_signals ADD COLUMN IF NOT EXISTS dedup_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cult_signals_dedup
  ON cult_signals (dedup_key) WHERE dedup_key IS NOT NULL;
