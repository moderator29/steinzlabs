-- §3 P2-E reputation feedback loop. When a user-held token rugs (price
-- drops to <5% of the buy price AND on-chain activity has stopped for
-- >7d), we file a rug_event_report. Once any (chain, deployer) pair
-- accumulates ≥2 reports, the deployer's band is downgraded one tier.
--
-- Bands (existing in deployer_history_cache): pristine → clean → caution
-- → dangerous → serial-rugger. Downgrade is one step toward
-- serial-rugger per pair of confirmed rugs.

CREATE TABLE IF NOT EXISTS public.rug_event_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  chain           text NOT NULL,
  token_address   text NOT NULL,
  deployer_address text,                       -- nullable: filled by enrichment
  buy_tx_hash     text,
  buy_price_usd   numeric,
  current_price_usd numeric,
  reported_at     timestamptz NOT NULL DEFAULT now(),
  confidence      numeric NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  source          text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'user_report', 'community')),
  applied_to_band boolean NOT NULL DEFAULT false,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS rug_event_reports_deployer_idx ON public.rug_event_reports (chain, deployer_address) WHERE deployer_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS rug_event_reports_token_idx    ON public.rug_event_reports (chain, token_address);
CREATE INDEX IF NOT EXISTS rug_event_reports_pending_idx  ON public.rug_event_reports (applied_to_band) WHERE applied_to_band = false;
CREATE UNIQUE INDEX IF NOT EXISTS rug_event_reports_user_token_uniq
  ON public.rug_event_reports (user_id, chain, token_address)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.rug_event_reports ENABLE ROW LEVEL SECURITY;

-- Users see their own reports; service-role inserts the auto-generated ones.
CREATE POLICY IF NOT EXISTS "rug_event_reports_own_read"
  ON public.rug_event_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
