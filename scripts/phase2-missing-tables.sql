-- =====================================================
-- STEINZ LABS — PHASE 2 MISSING TABLES
-- Run after phase1-schema.sql
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── platform_settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only platform_settings"
  ON platform_settings FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── api_logs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint    TEXT NOT NULL,
  method      TEXT NOT NULL DEFAULT 'GET',
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip          TEXT,
  status_code INTEGER NOT NULL DEFAULT 200,
  duration_ms INTEGER,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_user ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full api_logs"
  ON api_logs FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── vtx_query_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vtx_query_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message      TEXT NOT NULL,
  tools_used   TEXT[] DEFAULT '{}',
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  model        TEXT DEFAULT 'claude-sonnet-4-6',
  latency_ms   INTEGER,
  tier         TEXT DEFAULT 'free',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vtx_logs_user ON vtx_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_vtx_logs_created ON vtx_query_logs(created_at DESC);
ALTER TABLE vtx_query_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own vtx_query_logs"
  ON vtx_query_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full vtx_query_logs"
  ON vtx_query_logs FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── announcements ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'critical')),
  target_tier TEXT DEFAULT 'all' CHECK (target_tier IN ('all', 'free', 'pro', 'elite')),
  active      BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, expires_at);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users read active announcements"
  ON announcements FOR SELECT USING (active = true AND (expires_at IS NULL OR expires_at > NOW()));
CREATE POLICY "Service role manage announcements"
  ON announcements FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── broadcast_templates ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  variables   TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE broadcast_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manage broadcast_templates"
  ON broadcast_templates FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── research_views ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES research_posts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip          TEXT,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_research_views_post ON research_views(post_id);
CREATE INDEX IF NOT EXISTS idx_research_views_user ON research_views(user_id);
ALTER TABLE research_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert research_views"
  ON research_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role read research_views"
  ON research_views FOR SELECT USING (auth.role() = 'service_role');

-- ─── admin_notes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'token', 'wallet', 'swap', 'broadcast')),
  target_id   TEXT NOT NULL,
  note        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_notes_target ON admin_notes(target_type, target_id);
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only notes"
  ON admin_notes FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── settings_audit_log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  setting_key TEXT NOT NULL,
  old_value   JSONB,
  new_value   JSONB,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settings_audit_key ON settings_audit_log(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_audit_admin ON settings_audit_log(admin_id);
ALTER TABLE settings_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role settings_audit_log"
  ON settings_audit_log FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
