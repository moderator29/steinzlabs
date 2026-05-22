-- §5.3 Dune Analytics integration schema.
--
-- 10 new tables holding cached materialized results + credit budget
-- governance + alerts. The Dune client (lib/services/dune.ts) writes
-- through dune_cache; the use-surface VTX tools and crons read from
-- the typed materialized tables. wallet_edges keeps its existing
-- shape — no ALTER needed for §5.3.

-- Generic cache layer for any Dune query/params combo.
CREATE TABLE IF NOT EXISTS public.dune_cache (
  id              bigserial PRIMARY KEY,
  query_id        text NOT NULL,                -- Dune query ID or our slug
  params_hash     text NOT NULL,                -- sha256 of normalized params
  payload         jsonb NOT NULL,
  credits_used    int NOT NULL DEFAULT 0,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  ttl_seconds     int NOT NULL DEFAULT 86400,   -- default 1d
  source          text NOT NULL DEFAULT 'dune' CHECK (source IN ('dune', 'sim'))
);

CREATE UNIQUE INDEX IF NOT EXISTS dune_cache_query_params_uniq
  ON public.dune_cache (query_id, params_hash);
CREATE INDEX IF NOT EXISTS dune_cache_fresh_idx
  ON public.dune_cache (query_id, fetched_at DESC);

ALTER TABLE public.dune_cache ENABLE ROW LEVEL SECURITY;
-- Service-role only.

-- §5.7 monthly credit budget — one row per (month, plan). The Dune
-- client increments credits_used each call; soft-warn at 80%, hard-block
-- at 95%.
CREATE TABLE IF NOT EXISTS public.dune_budget (
  month          date PRIMARY KEY,            -- 2026-05-01 = May 2026 month
  plan           text NOT NULL CHECK (plan IN ('free', 'analyst', 'plus', 'enterprise')),
  credits_used   int NOT NULL DEFAULT 0,
  queries_used   int NOT NULL DEFAULT 0,
  credit_cap     int NOT NULL,                -- plan ceiling (free=2500, analyst=25000, plus=100000)
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dune_budget ENABLE ROW LEVEL SECURITY;

-- §5.4 materialized result tables. Each holds the latest snapshot of
-- one of the 7 refreshable queries. Updated by the dune-refresh cron
-- on the tier-appropriate schedule (daily / hourly / on-demand).

CREATE TABLE IF NOT EXISTS public.dune_holder_concentration (
  token_address  text NOT NULL,
  chain          text NOT NULL,
  top1_pct       numeric,
  top10_pct      numeric,
  top50_pct      numeric,
  top100_pct     numeric,
  gini           numeric,
  nakamoto       int,                          -- count of addresses needed to control 51%
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_address, chain)
);
CREATE INDEX IF NOT EXISTS dune_holder_conc_age_idx ON public.dune_holder_concentration (fetched_at);
ALTER TABLE public.dune_holder_concentration ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_holder_conc_public_read"
  ON public.dune_holder_concentration FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.dune_smart_money_score (
  wallet_address text NOT NULL,
  chain          text NOT NULL,
  score          numeric NOT NULL,              -- 0-100
  win_rate_pct   numeric,
  realized_pnl_usd_90d numeric,
  trade_count_90d int,
  basis          jsonb,                          -- explainability blob
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, chain)
);
CREATE INDEX IF NOT EXISTS dune_smart_money_score_idx ON public.dune_smart_money_score (score DESC);
ALTER TABLE public.dune_smart_money_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_smart_money_score_public_read"
  ON public.dune_smart_money_score FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.dune_cluster_aggregates (
  cluster_id     text NOT NULL,
  chain          text NOT NULL,
  member_count   int NOT NULL,
  total_volume_usd_24h numeric,
  net_flow_usd_24h     numeric,
  primary_label  text,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cluster_id, chain)
);
ALTER TABLE public.dune_cluster_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_cluster_agg_public_read"
  ON public.dune_cluster_aggregates FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.dune_bridge_flows (
  from_chain     text NOT NULL,
  to_chain       text NOT NULL,
  hour_bucket    timestamptz NOT NULL,
  total_usd      numeric NOT NULL,
  tx_count       int NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_chain, to_chain, hour_bucket)
);
CREATE INDEX IF NOT EXISTS dune_bridge_flows_recent_idx
  ON public.dune_bridge_flows (hour_bucket DESC);
ALTER TABLE public.dune_bridge_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_bridge_flows_public_read"
  ON public.dune_bridge_flows FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.dune_wash_trade_score (
  token_address  text NOT NULL,
  chain          text NOT NULL,
  score          numeric NOT NULL,              -- 0-100, higher = more wash-like
  flagged_pairs  int NOT NULL DEFAULT 0,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_address, chain)
);
ALTER TABLE public.dune_wash_trade_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_wash_trade_public_read"
  ON public.dune_wash_trade_score FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.dune_deployer_history (
  deployer_address text NOT NULL,
  chain          text NOT NULL,
  total_deployed int NOT NULL DEFAULT 0,
  total_rugged   int NOT NULL DEFAULT 0,
  total_successful int NOT NULL DEFAULT 0,
  oldest_deploy_at timestamptz,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deployer_address, chain)
);
ALTER TABLE public.dune_deployer_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_deployer_history_public_read"
  ON public.dune_deployer_history FOR SELECT USING (true);

-- §5.8 system alerts feed for ops when failure-ladder tier reaches 2+.
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL,
  tier           int NOT NULL,
  message        text NOT NULL,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_alerts_unresolved_idx
  ON public.system_alerts (created_at DESC) WHERE resolved_at IS NULL;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
-- Service-role only.

-- §5.5 dune_alerts — user-subscribed Dune-derived alerts (separate from
-- composite_alerts in P2-F because these specifically pull from the
-- materialized tables above).
CREATE TABLE IF NOT EXISTS public.dune_alerts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_id       text NOT NULL,                 -- which dune query to evaluate
  params         jsonb NOT NULL DEFAULT '{}'::jsonb,
  predicate      jsonb NOT NULL,                -- threshold expr (e.g. { metric: 'score', op: '>', value: 80 })
  last_fired_at  timestamptz,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dune_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "dune_alerts_own"
  ON public.dune_alerts FOR ALL TO authenticated
  USING (user_id = auth.uid());
