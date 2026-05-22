-- Final gap closures — surfaces the remaining §5.6 items that have
-- legitimate on-chain / public-API data sources (no Dune query needed):
--   * first_buyer_performance — Trading Terminal §5.6/7
--   * insider_wallets — Context Feed insider_wallet card
--   * funding_rate_snapshots — Context Feed funding_rate_divergence card
--   * sybil_cluster_candidates — Network Graph §5.6 sybil detection
--   * common_deposit_groups — Network Graph §5.6 common-deposit clustering

CREATE TABLE IF NOT EXISTS public.dune_first_buyer_performance (
  token_address      text NOT NULL,
  chain              text NOT NULL,
  avg_pnl_pct_30d    numeric,
  median_pnl_pct_30d numeric,
  sample_size        int NOT NULL DEFAULT 0,
  first_buyers       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- top-N first buyers + their PnL
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_address, chain)
);
ALTER TABLE public.dune_first_buyer_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_first_buyer_perf_public_read"
  ON public.dune_first_buyer_performance FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.dune_insider_wallets (
  id               bigserial PRIMARY KEY,
  wallet_address   text NOT NULL,
  token_address    text NOT NULL,
  chain            text NOT NULL,
  bought_at        timestamptz NOT NULL,
  listed_at        timestamptz,
  lead_time_hours  numeric,                                 -- bought_at - listed_at (negative = insider)
  buy_usd          numeric,
  detected_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dune_insider_wallets_token_idx
  ON public.dune_insider_wallets (chain, token_address, detected_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS dune_insider_wallets_uniq
  ON public.dune_insider_wallets (wallet_address, token_address, chain);
ALTER TABLE public.dune_insider_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_insider_wallets_public_read"
  ON public.dune_insider_wallets FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.funding_rate_snapshots (
  exchange         text NOT NULL,                           -- 'hyperliquid', 'binance_perp', ...
  symbol           text NOT NULL,                           -- 'BTC', 'ETH', 'SOL', ...
  funding_rate_hr  numeric NOT NULL,                        -- e.g. 0.0001 = 1bps/h
  mark_price_usd   numeric,
  spot_price_usd   numeric,
  divergence_pct   numeric,
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exchange, symbol)
);
CREATE INDEX IF NOT EXISTS funding_rate_snapshots_age_idx
  ON public.funding_rate_snapshots (fetched_at);
ALTER TABLE public.funding_rate_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "funding_rate_snapshots_public_read"
  ON public.funding_rate_snapshots FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.sybil_cluster_candidates (
  id               bigserial PRIMARY KEY,
  chain            text NOT NULL,
  cluster_key      text NOT NULL,                           -- common_funder address or shared-creation-day key
  member_addresses text[] NOT NULL,
  signal_type      text NOT NULL CHECK (signal_type IN ('common_funder', 'same_day_creation', 'common_deposit')),
  confidence       numeric NOT NULL DEFAULT 0.5,            -- 0..1
  detected_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sybil_cluster_candidates_chain_idx
  ON public.sybil_cluster_candidates (chain, detected_at DESC);
ALTER TABLE public.sybil_cluster_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "sybil_cluster_candidates_public_read"
  ON public.sybil_cluster_candidates FOR SELECT USING (true);
