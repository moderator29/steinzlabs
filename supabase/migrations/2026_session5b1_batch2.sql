-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS SESSION 5B-1 BATCH 2 MIGRATION
-- Whale Tracker (Phase 5), Copy Trading (Phase 6), Wallet Clusters (Phase 7)
-- Run ONCE in Supabase SQL Editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ─── PHASE 5: WHALES ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  label TEXT,
  entity_type TEXT CHECK (entity_type IN ('vc', 'trader', 'fund', 'exchange', 'dev', 'influencer', 'institutional', 'unknown')),
  portfolio_value_usd NUMERIC,
  pnl_7d_usd NUMERIC,
  pnl_30d_usd NUMERIC,
  pnl_90d_usd NUMERIC,
  win_rate NUMERIC,
  trade_count_30d INT,
  avg_hold_hours NUMERIC,
  archetype TEXT,
  whale_score INT DEFAULT 0,
  follower_count INT DEFAULT 0,
  x_handle TEXT,
  tg_handle TEXT,
  website TEXT,
  verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain)
);
CREATE INDEX IF NOT EXISTS whales_score_idx ON whales(whale_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS whales_chain_idx ON whales(chain, whale_score DESC);
CREATE INDEX IF NOT EXISTS whales_entity_idx ON whales(entity_type);
CREATE INDEX IF NOT EXISTS whales_search_idx ON whales USING gin(to_tsvector('english', coalesce(label, '') || ' ' || address));
ALTER TABLE whales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_whales" ON whales;
CREATE POLICY "anyone_reads_whales" ON whales FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "service_role_whales" ON whales;
CREATE POLICY "service_role_whales" ON whales FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS whale_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'transfer_in', 'transfer_out', 'swap', 'approve', 'stake', 'unstake', 'mint', 'burn')),
  token_address TEXT,
  token_symbol TEXT,
  amount NUMERIC,
  value_usd NUMERIC,
  counterparty TEXT,
  counterparty_label TEXT,
  block_number BIGINT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tx_hash, whale_address, chain)
);
CREATE INDEX IF NOT EXISTS whale_activity_whale_idx ON whale_activity(whale_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_activity_token_idx ON whale_activity(token_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_activity_ts_idx ON whale_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_activity_value_idx ON whale_activity(value_usd DESC) WHERE value_usd > 50000;
ALTER TABLE whale_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_whale_activity" ON whale_activity;
CREATE POLICY "anyone_reads_whale_activity" ON whale_activity FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_whale_activity" ON whale_activity;
CREATE POLICY "service_role_whale_activity" ON whale_activity FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS user_whale_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whale_id UUID REFERENCES whales(id) ON DELETE CASCADE,
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  label TEXT,
  copy_mode TEXT DEFAULT 'alerts' CHECK (copy_mode IN ('alerts', 'oneclick')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, whale_address, chain)
);
CREATE INDEX IF NOT EXISTS user_whale_follows_user_idx ON user_whale_follows(user_id);
CREATE INDEX IF NOT EXISTS user_whale_follows_whale_idx ON user_whale_follows(whale_address, chain);
ALTER TABLE user_whale_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_whale_follows" ON user_whale_follows;
CREATE POLICY "users_own_whale_follows" ON user_whale_follows FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_whale_follows" ON user_whale_follows;
CREATE POLICY "service_role_whale_follows" ON user_whale_follows FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS whale_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  proposed_label TEXT,
  proposed_entity_type TEXT,
  reason TEXT,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whale_submissions_status_idx ON whale_submissions(status, created_at DESC);
ALTER TABLE whale_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_submit_whales" ON whale_submissions;
CREATE POLICY "users_submit_whales" ON whale_submissions FOR INSERT TO authenticated WITH CHECK (submitter_id = auth.uid());
DROP POLICY IF EXISTS "users_read_own_submissions" ON whale_submissions;
CREATE POLICY "users_read_own_submissions" ON whale_submissions FOR SELECT TO authenticated USING (submitter_id = auth.uid());
DROP POLICY IF EXISTS "service_role_submissions" ON whale_submissions;
CREATE POLICY "service_role_submissions" ON whale_submissions FOR ALL TO service_role USING (true);

-- ─── PHASE 6: COPY TRADING ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_copy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  max_per_trade_usd NUMERIC NOT NULL,
  daily_cap_usd NUMERIC NOT NULL,
  chains_allowed TEXT[],
  tokens_blacklist TEXT[],
  min_liquidity_usd NUMERIC DEFAULT 50000,
  max_slippage_bps INT DEFAULT 200,
  require_confirmation BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, whale_address, chain)
);
ALTER TABLE user_copy_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_copy_rules" ON user_copy_rules;
CREATE POLICY "users_own_copy_rules" ON user_copy_rules FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_copy_rules" ON user_copy_rules;
CREATE POLICY "service_role_copy_rules" ON user_copy_rules FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS user_copy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_whale TEXT NOT NULL,
  source_tx_hash TEXT NOT NULL,
  copied_tx_hash TEXT,
  chain TEXT,
  token_address TEXT,
  token_symbol TEXT,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
  amount_usd NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'blocked_security', 'blocked_rule')),
  failure_reason TEXT,
  security_score INT,
  pnl_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS copy_trades_user_idx ON user_copy_trades(user_id, created_at DESC);
ALTER TABLE user_copy_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_copy_trades" ON user_copy_trades;
CREATE POLICY "users_own_copy_trades" ON user_copy_trades FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_copy_trades" ON user_copy_trades;
CREATE POLICY "service_role_copy_trades" ON user_copy_trades FOR ALL TO service_role USING (true);

-- ─── PHASE 7: WALLET CLUSTERS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS wallet_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('common_funding', 'coordinated_trading', 'direct_transfer', 'behavioral_fingerprint', 'sybil_pattern')),
  weight NUMERIC DEFAULT 1,
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  transaction_count INT DEFAULT 1,
  total_value_usd NUMERIC,
  UNIQUE(from_address, to_address, chain, edge_type)
);
CREATE INDEX IF NOT EXISTS wallet_edges_from_idx ON wallet_edges(from_address);
CREATE INDEX IF NOT EXISTS wallet_edges_to_idx ON wallet_edges(to_address);
CREATE INDEX IF NOT EXISTS wallet_edges_type_idx ON wallet_edges(edge_type, confidence DESC);
ALTER TABLE wallet_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_wallet_edges" ON wallet_edges;
CREATE POLICY "anyone_reads_wallet_edges" ON wallet_edges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_wallet_edges" ON wallet_edges;
CREATE POLICY "service_role_wallet_edges" ON wallet_edges FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS cluster_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes INT DEFAULT 0,
  downvotes INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cluster_labels_cluster_idx ON cluster_labels(cluster_key, status);
ALTER TABLE cluster_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_cluster_labels" ON cluster_labels;
CREATE POLICY "anyone_reads_cluster_labels" ON cluster_labels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users_submit_cluster_labels" ON cluster_labels;
CREATE POLICY "users_submit_cluster_labels" ON cluster_labels FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());
DROP POLICY IF EXISTS "service_role_cluster_labels" ON cluster_labels;
CREATE POLICY "service_role_cluster_labels" ON cluster_labels FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS cluster_label_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID NOT NULL REFERENCES cluster_labels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(label_id, user_id)
);
CREATE INDEX IF NOT EXISTS cluster_label_votes_label_idx ON cluster_label_votes(label_id);
ALTER TABLE cluster_label_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_cluster_votes" ON cluster_label_votes;
CREATE POLICY "users_own_cluster_votes" ON cluster_label_votes FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "anyone_reads_cluster_votes" ON cluster_label_votes;
CREATE POLICY "anyone_reads_cluster_votes" ON cluster_label_votes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_cluster_votes" ON cluster_label_votes;
CREATE POLICY "service_role_cluster_votes" ON cluster_label_votes FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS user_reputation (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'scout' CHECK (tier IN ('scout', 'analyst', 'detective', 'officer')),
  approved_labels INT DEFAULT 0,
  approved_whale_submissions INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_reputation" ON user_reputation;
CREATE POLICY "users_read_own_reputation" ON user_reputation FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "anyone_reads_reputation" ON user_reputation;
CREATE POLICY "anyone_reads_reputation" ON user_reputation FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_reputation" ON user_reputation;
CREATE POLICY "service_role_reputation" ON user_reputation FOR ALL TO service_role USING (true);
