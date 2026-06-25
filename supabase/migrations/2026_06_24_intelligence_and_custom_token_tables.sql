-- Intelligence + custom-token tables (applied live 2026-06-24).
--
-- funding_rate_snapshots  — written by /api/cron/funding-rates-snapshot
--                           (upsert onConflict exchange,symbol), read by the
--                           Dune funding-divergence surface.
-- goplus_security_cache   — per (token_address, chain) cached GoPlus payload,
--                           read by the Swap intelligence honeypot/tax strip.
-- user_custom_tokens      — server-side persistence + cross-device sync for the
--                           wallet "Add Custom Token" feature (was localStorage).

CREATE TABLE IF NOT EXISTS public.funding_rate_snapshots (
  id bigserial PRIMARY KEY,
  exchange text NOT NULL,
  symbol text NOT NULL,
  funding_rate_hr numeric,
  mark_price_usd numeric,
  spot_price_usd numeric,
  divergence_pct numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funding_rate_snapshots_exchange_symbol_uniq UNIQUE (exchange, symbol)
);
CREATE INDEX IF NOT EXISTS funding_rate_snapshots_fresh_idx ON public.funding_rate_snapshots (fetched_at DESC);
ALTER TABLE public.funding_rate_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "funding_rate_snapshots_public_read" ON public.funding_rate_snapshots;
CREATE POLICY "funding_rate_snapshots_public_read" ON public.funding_rate_snapshots FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.goplus_security_cache (
  token_address text NOT NULL,
  chain text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_address, chain)
);
CREATE INDEX IF NOT EXISTS goplus_security_cache_fresh_idx ON public.goplus_security_cache (fetched_at DESC);
ALTER TABLE public.goplus_security_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goplus_security_cache_public_read" ON public.goplus_security_cache;
CREATE POLICY "goplus_security_cache_public_read" ON public.goplus_security_cache FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_custom_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain text NOT NULL,
  contract text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_custom_tokens_uniq UNIQUE (user_id, chain, contract)
);
CREATE INDEX IF NOT EXISTS user_custom_tokens_user_idx ON public.user_custom_tokens (user_id);
ALTER TABLE public.user_custom_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_custom_tokens_own" ON public.user_custom_tokens;
CREATE POLICY "user_custom_tokens_own" ON public.user_custom_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
