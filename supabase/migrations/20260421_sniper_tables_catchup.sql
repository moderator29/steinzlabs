-- Schema-drift catch-up for sniper_criteria + sniper_match_events.
-- Both tables exist in prod (phvewrldcdxupsnakddx) but had no migration
-- file in supabase/migrations/. This file reconciles the repo with
-- the live schema so a fresh Supabase bootstrap reproduces production.
--
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT-safe).
-- Verified against prod via pg_catalog introspection on 2026-04-21.

CREATE TABLE IF NOT EXISTS public.sniper_criteria (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  enabled               boolean DEFAULT true,
  trigger_type          text NOT NULL CHECK (trigger_type IN ('new_token_launch','whale_buy','price_target')),
  chains_allowed        text[] NOT NULL,
  min_liquidity_usd     numeric NOT NULL DEFAULT 10000,
  max_buy_tax_bps       integer DEFAULT 1000,
  max_sell_tax_bps      integer DEFAULT 1000,
  min_holder_count      integer DEFAULT 10,
  max_age_hours         integer DEFAULT 48,
  min_security_score    integer DEFAULT 60,
  block_honeypots       boolean DEFAULT true,
  trigger_whale_address text,
  trigger_price_target  numeric,
  amount_per_snipe_usd  numeric NOT NULL,
  daily_max_snipes      integer DEFAULT 5,
  daily_max_spend_usd   numeric DEFAULT 500,
  auto_execute          boolean DEFAULT false,
  wallet_source         text NOT NULL DEFAULT 'builtin' CHECK (wallet_source IN ('metamask','phantom','builtin')),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sniper_criteria_user_idx
  ON public.sniper_criteria (user_id, enabled);

CREATE TABLE IF NOT EXISTS public.sniper_match_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_id           uuid NOT NULL REFERENCES public.sniper_criteria(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matched_token_address text NOT NULL,
  matched_chain         text NOT NULL,
  trigger_reason        text,
  decision              text NOT NULL CHECK (decision IN ('matched','sniped_pending','sniped_executed','skipped','failed')),
  pending_trade_id      uuid REFERENCES public.pending_trades(id),
  executed_tx_hash      text,
  pnl_usd               numeric,
  details               jsonb,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sniper_match_events_user_idx
  ON public.sniper_match_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sniper_match_events_criteria_idx
  ON public.sniper_match_events (criteria_id, created_at DESC);

ALTER TABLE public.sniper_criteria      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sniper_match_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_sniper_criteria ON public.sniper_criteria;
CREATE POLICY users_own_sniper_criteria
  ON public.sniper_criteria
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS service_role_sniper_criteria ON public.sniper_criteria;
CREATE POLICY service_role_sniper_criteria
  ON public.sniper_criteria
  FOR ALL TO service_role
  USING (true);

DROP POLICY IF EXISTS users_own_sniper_match_events ON public.sniper_match_events;
CREATE POLICY users_own_sniper_match_events
  ON public.sniper_match_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS service_role_sniper_match_events ON public.sniper_match_events;
CREATE POLICY service_role_sniper_match_events
  ON public.sniper_match_events
  FOR ALL TO service_role
  USING (true);
