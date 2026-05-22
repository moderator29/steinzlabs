-- §5 audit gap closures (per brutal-honest audit of feat/dune-integration
-- and feat/dune-use-surfaces-and-followups).
--
-- Adds the three tables/columns the audit flagged as missing AND a
-- shingle bitmap column on rug_contract_signatures so the Tier-2 Jaccard
-- bytecode comparison can finally run live.

-- 1. wallet_edges ALTER — kickoff §5.3 calls for source, weight, and
-- dune_query_id columns so the cluster cron can attribute edges to the
-- materialized query that produced them.
ALTER TABLE public.wallet_edges
  ADD COLUMN IF NOT EXISTS source         text,
  ADD COLUMN IF NOT EXISTS weight         numeric,
  ADD COLUMN IF NOT EXISTS dune_query_id  text;

CREATE INDEX IF NOT EXISTS wallet_edges_source_idx
  ON public.wallet_edges (source)
  WHERE source IS NOT NULL;

-- 2. dune_token_age_buyers — distribution of buyers by wallet-age cohort
-- for a given token. Populated by the dune-refresh cron once
-- DUNE_QUERY_TOKEN_AGE_BUYERS is set.
CREATE TABLE IF NOT EXISTS public.dune_token_age_buyers (
  token_address      text NOT NULL,
  chain              text NOT NULL,
  age_under_7d_pct   numeric,
  age_7_30d_pct      numeric,
  age_30_90d_pct     numeric,
  age_over_90d_pct   numeric,
  total_buyers       int,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_address, chain)
);
CREATE INDEX IF NOT EXISTS dune_token_age_buyers_age_idx
  ON public.dune_token_age_buyers (fetched_at);
ALTER TABLE public.dune_token_age_buyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_token_age_buyers_public_read"
  ON public.dune_token_age_buyers FOR SELECT USING (true);

-- 3. dune_smart_money_token_flow — the missing token-level rollup from
-- §5.4 row 6 "Smart-money inflow (top 200 tokens)". Per (token, chain)
-- 24h net inflow USD + buyer/seller counts from smart-money cohort.
CREATE TABLE IF NOT EXISTS public.dune_smart_money_token_flow (
  token_address       text NOT NULL,
  chain               text NOT NULL,
  net_inflow_usd_24h  numeric NOT NULL,
  buyers_24h          int NOT NULL DEFAULT 0,
  sellers_24h         int NOT NULL DEFAULT 0,
  unique_wallets_24h  int NOT NULL DEFAULT 0,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_address, chain)
);
CREATE INDEX IF NOT EXISTS dune_smart_money_token_flow_idx
  ON public.dune_smart_money_token_flow (chain, net_inflow_usd_24h DESC);
ALTER TABLE public.dune_smart_money_token_flow ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_smart_money_token_flow_public_read"
  ON public.dune_smart_money_token_flow FOR SELECT USING (true);

-- 4. dune_stablecoin_pulse — §5.6 Context Feed stablecoin_pulse card data.
CREATE TABLE IF NOT EXISTS public.dune_stablecoin_pulse (
  chain               text NOT NULL,
  hour_bucket         timestamptz NOT NULL,
  usdc_net_flow_usd   numeric NOT NULL DEFAULT 0,
  usdt_net_flow_usd   numeric NOT NULL DEFAULT 0,
  dai_net_flow_usd    numeric NOT NULL DEFAULT 0,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain, hour_bucket)
);
CREATE INDEX IF NOT EXISTS dune_stablecoin_pulse_recent_idx
  ON public.dune_stablecoin_pulse (hour_bucket DESC);
ALTER TABLE public.dune_stablecoin_pulse ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_stablecoin_pulse_public_read"
  ON public.dune_stablecoin_pulse FOR SELECT USING (true);

-- 5. dune_cex_flow — §5.6 Context Feed cex_drain card data + tier-2 tool.
CREATE TABLE IF NOT EXISTS public.dune_cex_flow (
  chain               text NOT NULL,
  exchange            text NOT NULL,           -- 'binance', 'coinbase', 'okx', ...
  hour_bucket         timestamptz NOT NULL,
  net_inflow_usd      numeric NOT NULL DEFAULT 0,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain, exchange, hour_bucket)
);
CREATE INDEX IF NOT EXISTS dune_cex_flow_recent_idx
  ON public.dune_cex_flow (hour_bucket DESC);
ALTER TABLE public.dune_cex_flow ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_cex_flow_public_read"
  ON public.dune_cex_flow FOR SELECT USING (true);

-- 6. rug_contract_signatures shingle bitmap — §3 P1-D.5 Tier-2 Jaccard
-- comparison. Stored as comma-joined 8-byte hex tokens so the scanner
-- can compute Jaccard live without re-fetching bytecode.
ALTER TABLE public.rug_contract_signatures
  ADD COLUMN IF NOT EXISTS shingles text;

-- 7. dune_mev_loss_aggregate — per-wallet MEV loss over 30d for the
-- mev_loss_report tier-2 tool.
CREATE TABLE IF NOT EXISTS public.dune_mev_loss_aggregate (
  wallet_address    text NOT NULL,
  chain             text NOT NULL,
  total_loss_usd_30d numeric NOT NULL DEFAULT 0,
  sandwich_count    int NOT NULL DEFAULT 0,
  frontrun_count    int NOT NULL DEFAULT 0,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, chain)
);
ALTER TABLE public.dune_mev_loss_aggregate ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_mev_loss_aggregate_public_read"
  ON public.dune_mev_loss_aggregate FOR SELECT USING (true);
