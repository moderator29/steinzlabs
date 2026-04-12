-- =====================================================
-- STEINZ LABS — PHASE 1 SCHEMA ADDITIONS
-- Run in Supabase SQL Editor after schema-complete.sql
-- =====================================================

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── wallet_profiles ──────────────────────────────────────────────────────────
-- Linked wallets per user (multi-chain)

CREATE TABLE IF NOT EXISTS wallet_profiles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address      TEXT NOT NULL,
  chain        TEXT NOT NULL DEFAULT 'ethereum',
  label        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, address, chain)
);

CREATE INDEX IF NOT EXISTS idx_wallet_profiles_user ON wallet_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_profiles_address ON wallet_profiles(address);

-- RLS
ALTER TABLE wallet_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own wallets"
  ON wallet_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── swap_logs ────────────────────────────────────────────────────────────────
-- Every swap attempt routed through the platform

CREATE TABLE IF NOT EXISTS swap_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  chain         TEXT NOT NULL,
  input_token   TEXT NOT NULL,
  output_token  TEXT NOT NULL,
  input_amount  DECIMAL(30, 10) NOT NULL DEFAULT 0,
  output_amount DECIMAL(30, 10) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  tx_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_logs_user ON swap_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_swap_logs_status ON swap_logs(status);
CREATE INDEX IF NOT EXISTS idx_swap_logs_created ON swap_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swap_logs_tx ON swap_logs(tx_hash) WHERE tx_hash IS NOT NULL;

-- RLS
ALTER TABLE swap_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own swap logs"
  ON swap_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update (no user policy needed for writes — done server-side)
CREATE POLICY "Service role full access on swap_logs"
  ON swap_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── fee_revenue ──────────────────────────────────────────────────────────────
-- Platform fee tracking for admin/analytics

CREATE TABLE IF NOT EXISTS fee_revenue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tx_hash         TEXT NOT NULL,
  chain           TEXT NOT NULL,
  fee_usd         DECIMAL(20, 6) NOT NULL DEFAULT 0,
  fee_bps         INTEGER NOT NULL DEFAULT 15,
  input_token     TEXT NOT NULL,
  output_token    TEXT NOT NULL,
  input_value_usd DECIMAL(20, 6) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_revenue_user ON fee_revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_fee_revenue_created ON fee_revenue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_revenue_chain ON fee_revenue(chain);

-- Only service role can read/write fee_revenue
ALTER TABLE fee_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on fee_revenue"
  ON fee_revenue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── sniper_executions ────────────────────────────────────────────────────────
-- Sniper bot trade log

CREATE TABLE IF NOT EXISTS sniper_executions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain            TEXT NOT NULL,
  token_address    TEXT NOT NULL,
  buy_amount_usd   DECIMAL(20, 6) NOT NULL DEFAULT 0,
  tx_hash          TEXT,
  status           TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'executing', 'completed', 'failed')),
  stop_loss_pct    DECIMAL(6, 2),
  take_profit_pct  DECIMAL(6, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sniper_user ON sniper_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_sniper_status ON sniper_executions(status);
CREATE INDEX IF NOT EXISTS idx_sniper_created ON sniper_executions(created_at DESC);

ALTER TABLE sniper_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sniper executions"
  ON sniper_executions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── whale_watchlist ──────────────────────────────────────────────────────────
-- Per-user list of wallets to watch for whale activity

CREATE TABLE IF NOT EXISTS whale_watchlist (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address               TEXT NOT NULL,
  chain                 TEXT NOT NULL DEFAULT 'ethereum',
  label                 TEXT,
  alert_threshold_usd   DECIMAL(20, 2) NOT NULL DEFAULT 100000,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, address, chain)
);

CREATE INDEX IF NOT EXISTS idx_whale_watchlist_user ON whale_watchlist(user_id);

ALTER TABLE whale_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own whale watchlist"
  ON whale_watchlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── broadcasts ───────────────────────────────────────────────────────────────
-- Admin email broadcast management

CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  html             TEXT NOT NULL,
  sent_at          TIMESTAMPTZ,
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  opened_count     INTEGER NOT NULL DEFAULT 0,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_sent ON broadcasts(sent_at DESC) WHERE sent_at IS NOT NULL;

-- Only admins / service role can manage broadcasts
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on broadcasts"
  ON broadcasts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── research_posts ───────────────────────────────────────────────────────────
-- VTX AI-generated research / admin-published posts

CREATE TABLE IF NOT EXISTS research_posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  summary       TEXT,
  content       TEXT NOT NULL,
  token_symbol  TEXT,
  token_address TEXT,
  chain         TEXT,
  tags          TEXT[] DEFAULT '{}',
  published     BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_slug ON research_posts(slug);
CREATE INDEX IF NOT EXISTS idx_research_published ON research_posts(published_at DESC) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_research_token ON research_posts(token_symbol);

ALTER TABLE research_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Published posts are publicly readable"
  ON research_posts FOR SELECT
  USING (published = true);

-- Service role can do anything
CREATE POLICY "Service role full access on research_posts"
  ON research_posts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── token_cache ──────────────────────────────────────────────────────────────
-- Persistent cache for token security scan results

CREATE TABLE IF NOT EXISTS token_cache (
  address       TEXT NOT NULL,
  chain         TEXT NOT NULL,
  risk_score    INTEGER,
  is_honeypot   BOOLEAN,
  is_blacklisted BOOLEAN,
  scan_data     JSONB,
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (address, chain)
);

CREATE INDEX IF NOT EXISTS idx_token_cache_scanned ON token_cache(scanned_at DESC);

-- No RLS needed — service role only
ALTER TABLE token_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on token_cache"
  ON token_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── profiles column additions ────────────────────────────────────────────────
-- Add columns to existing profiles table if not present

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'elite')),
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_email TEXT;

-- ─── Helper: updated_at trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_research_posts_updated_at
  BEFORE UPDATE ON research_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
