-- Sniper detection feed. Populated by the /api/webhooks/sniper-detect
-- endpoint that receives Alchemy AddressActivity + Helius enhanced webhooks.
-- Frontend /dashboard/sniper streams recent rows; criteria-matcher worker
-- decides which ones to auto-buy.

CREATE TABLE IF NOT EXISTS public.sniper_detected_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       TEXT NOT NULL CHECK (provider IN ('alchemy','helius','manual')),
  chain          TEXT NOT NULL,
  token_address  TEXT NOT NULL,
  token_symbol   TEXT,
  from_address   TEXT,
  amount_usd     NUMERIC,
  tx_hash        TEXT,
  observed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  safety_gate    JSONB,
  safety_passed  BOOLEAN,
  raw            JSONB
);

CREATE INDEX IF NOT EXISTS idx_sniper_detected_observed ON public.sniper_detected_tokens (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sniper_detected_chain_token ON public.sniper_detected_tokens (chain, token_address);

ALTER TABLE public.sniper_detected_tokens ENABLE ROW LEVEL SECURITY;

-- Read access: only paid tiers from the criteria_matcher (service role)
-- drive population. For UX we let Max-tier users stream the feed via a
-- server-authoritative endpoint — no direct-to-browser access.
DROP POLICY IF EXISTS "sniper_detected_tokens_service" ON public.sniper_detected_tokens;
CREATE POLICY "sniper_detected_tokens_service" ON public.sniper_detected_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
