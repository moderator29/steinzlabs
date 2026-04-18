-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS SESSION 5B-1 BATCH 3 MIGRATION
-- VTX shared conversations (Phase 8), Security scan history (Phase 9),
-- Wallet intelligence reports (Phase 10), VTX prompt favorites.
-- Run ONCE in Supabase SQL Editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ─── PHASE 8: VTX sharing + favorites ──────────────────────────

CREATE TABLE IF NOT EXISTS vtx_shared_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  snapshot JSONB NOT NULL,
  view_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vtx_shared_token_idx ON vtx_shared_conversations(share_token);
CREATE INDEX IF NOT EXISTS vtx_shared_owner_idx ON vtx_shared_conversations(owner_id, created_at DESC);
ALTER TABLE vtx_shared_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_manage_own_shares" ON vtx_shared_conversations;
CREATE POLICY "users_manage_own_shares" ON vtx_shared_conversations FOR ALL TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "anyone_reads_shares" ON vtx_shared_conversations;
CREATE POLICY "anyone_reads_shares" ON vtx_shared_conversations FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "service_role_shares" ON vtx_shared_conversations;
CREATE POLICY "service_role_shares" ON vtx_shared_conversations FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS user_vtx_prompt_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID,
  custom_title TEXT,
  custom_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prompt_id, custom_prompt)
);
CREATE INDEX IF NOT EXISTS vtx_fav_user_idx ON user_vtx_prompt_favorites(user_id);
ALTER TABLE user_vtx_prompt_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_vtx_fav" ON user_vtx_prompt_favorites;
CREATE POLICY "users_own_vtx_fav" ON user_vtx_prompt_favorites FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_vtx_fav" ON user_vtx_prompt_favorites;
CREATE POLICY "service_role_vtx_fav" ON user_vtx_prompt_favorites FOR ALL TO service_role USING (true);

-- ─── PHASE 9: Security scan history + alerts ───────────────────

CREATE TABLE IF NOT EXISTS security_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type TEXT NOT NULL CHECK (scan_type IN ('token', 'address', 'approval', 'domain')),
  target TEXT NOT NULL,
  chain TEXT,
  risk_score INT CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'critical')),
  reasons JSONB,
  goplus_raw JSONB,
  scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS security_scan_target_idx ON security_scan_history(target, scan_type, scanned_at DESC);
CREATE INDEX IF NOT EXISTS security_scan_user_idx ON security_scan_history(scanned_by, scanned_at DESC);
ALTER TABLE security_scan_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_scans" ON security_scan_history;
CREATE POLICY "users_read_own_scans" ON security_scan_history FOR SELECT TO authenticated USING (scanned_by = auth.uid() OR scanned_by IS NULL);
DROP POLICY IF EXISTS "service_role_security_scan" ON security_scan_history;
CREATE POLICY "service_role_security_scan" ON security_scan_history FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS user_security_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('token', 'address')),
  target TEXT NOT NULL,
  chain TEXT NOT NULL,
  notify_on_level TEXT NOT NULL DEFAULT 'high' CHECK (notify_on_level IN ('medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target, chain)
);
CREATE INDEX IF NOT EXISTS security_subs_user_idx ON user_security_subscriptions(user_id);
ALTER TABLE user_security_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_security_subs" ON user_security_subscriptions;
CREATE POLICY "users_own_security_subs" ON user_security_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_security_subs" ON user_security_subscriptions;
CREATE POLICY "service_role_security_subs" ON user_security_subscriptions FOR ALL TO service_role USING (true);

-- ─── PHASE 10: Wallet intelligence reports ─────────────────────

CREATE TABLE IF NOT EXISTS wallet_alpha_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  archetype TEXT,
  strengths JSONB,
  risks JSONB,
  recent_thesis TEXT,
  confidence NUMERIC(3,2),
  raw_context JSONB,
  model TEXT DEFAULT 'claude-sonnet-4-6',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wallet_alpha_addr_idx ON wallet_alpha_reports(wallet_address, chain, generated_at DESC);
ALTER TABLE wallet_alpha_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_reads_alpha" ON wallet_alpha_reports;
CREATE POLICY "authenticated_reads_alpha" ON wallet_alpha_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_alpha" ON wallet_alpha_reports;
CREATE POLICY "service_role_alpha" ON wallet_alpha_reports FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS user_wallet_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  alert_on JSONB NOT NULL DEFAULT '["large_trade", "new_token"]'::jsonb,
  min_trade_usd NUMERIC,
  notification_channels JSONB DEFAULT '["push", "telegram"]'::jsonb,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wallet_address, chain)
);
CREATE INDEX IF NOT EXISTS wallet_alerts_user_idx ON user_wallet_alerts(user_id);
CREATE INDEX IF NOT EXISTS wallet_alerts_wallet_idx ON user_wallet_alerts(wallet_address, chain) WHERE enabled = true;
ALTER TABLE user_wallet_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_wallet_alerts" ON user_wallet_alerts;
CREATE POLICY "users_own_wallet_alerts" ON user_wallet_alerts FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_wallet_alerts" ON user_wallet_alerts;
CREATE POLICY "service_role_wallet_alerts" ON user_wallet_alerts FOR ALL TO service_role USING (true);
