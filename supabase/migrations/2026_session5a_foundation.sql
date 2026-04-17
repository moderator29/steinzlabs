-- Session 5A Phase 8: Foundation tables
-- Run after 2026_session5a_auth.sql

-- ─── naka_prompts: featured VTX prompt cards ───────────────────────────────
CREATE TABLE IF NOT EXISTS naka_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER DEFAULT 100,
  is_featured BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS naka_prompts_featured_idx ON naka_prompts(is_featured, sort_order);
ALTER TABLE naka_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_read_prompts" ON naka_prompts;
CREATE POLICY "anyone_read_prompts" ON naka_prompts FOR SELECT TO authenticated, anon USING (is_featured = true);
DROP POLICY IF EXISTS "service_role_manage_prompts" ON naka_prompts;
CREATE POLICY "service_role_manage_prompts" ON naka_prompts FOR ALL TO service_role USING (true);

-- Seed featured prompts
INSERT INTO naka_prompts (title, prompt, category, sort_order)
VALUES
  ('Whale activity', 'Show me the biggest whale moves in the last 24 hours across ETH and SOL.', 'Whales', 10),
  ('Rug check', 'Scan this token for rug pull risks and contract red flags.', 'Security', 20),
  ('Smart money', 'Which wallets are smart money accumulating right now?', 'Smart Money', 30),
  ('Trending narratives', 'What narratives and tokens are trending on-chain this week?', 'Narrative', 40),
  ('Portfolio review', 'Analyze my wallet performance and suggest rebalancing.', 'Portfolio', 50),
  ('New launches', 'Show me promising new token launches with strong liquidity.', 'Launchpad', 60),
  ('Copy-trade ideas', 'Find profitable traders I should copy based on recent PnL.', 'Copy Trade', 70)
ON CONFLICT DO NOTHING;

-- ─── cluster_cache: wallet cluster analysis results ───────────────────────
CREATE TABLE IF NOT EXISTS cluster_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key TEXT NOT NULL UNIQUE,
  root_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  archetype TEXT,
  label TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS cluster_cache_root_idx ON cluster_cache(root_address);
CREATE INDEX IF NOT EXISTS cluster_cache_expires_idx ON cluster_cache(expires_at);
ALTER TABLE cluster_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_cluster_cache" ON cluster_cache;
CREATE POLICY "service_role_cluster_cache" ON cluster_cache FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "authenticated_read_cluster_cache" ON cluster_cache;
CREATE POLICY "authenticated_read_cluster_cache" ON cluster_cache FOR SELECT TO authenticated USING (true);

-- ─── market_stats_history: daily snapshots for chart data ─────────────────
CREATE TABLE IF NOT EXISTS market_stats_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_market_cap NUMERIC,
  total_volume NUMERIC,
  btc_dominance NUMERIC,
  fear_greed INTEGER,
  active_chains INTEGER,
  UNIQUE (snapshot_at)
);
CREATE INDEX IF NOT EXISTS market_stats_history_ts_idx ON market_stats_history(snapshot_at DESC);
ALTER TABLE market_stats_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_market_stats" ON market_stats_history;
CREATE POLICY "service_role_market_stats" ON market_stats_history FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "authenticated_read_market_stats" ON market_stats_history;
CREATE POLICY "authenticated_read_market_stats" ON market_stats_history FOR SELECT TO authenticated USING (true);

-- ─── vtx_conversation_id on vtx_messages (if messages stored separately) ──
-- Already covered by existing vtx_conversations.messages JSONB column.

-- ─── smart_money_rankings: pre-computed rankings refreshed by cron ────────
CREATE TABLE IF NOT EXISTS smart_money_rankings (
  address TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  label TEXT,
  pnl_30d NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  trade_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  rank INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS smart_money_rank_idx ON smart_money_rankings(rank ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS smart_money_chain_idx ON smart_money_rankings(chain);
ALTER TABLE smart_money_rankings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_smart_money" ON smart_money_rankings;
CREATE POLICY "service_role_smart_money" ON smart_money_rankings FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "authenticated_read_smart_money" ON smart_money_rankings;
CREATE POLICY "authenticated_read_smart_money" ON smart_money_rankings FOR SELECT TO authenticated USING (true);
