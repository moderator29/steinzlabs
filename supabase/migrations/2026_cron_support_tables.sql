-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — CRON SUPPORT TABLES
-- Run after the Session 5A migrations.
-- Creates tables used by scheduled jobs registered in /vercel.json.
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- token_popularity_history: per-tier aggregated popularity, refreshed hourly
CREATE TABLE IF NOT EXISTS token_popularity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id TEXT NOT NULL,
  chain TEXT NOT NULL,
  user_tier TEXT NOT NULL,
  popularity_score INT NOT NULL,
  watcher_count INT NOT NULL,
  window_label TEXT NOT NULL CHECK (window_label IN ('24h', '7d', '30d')),
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS token_popularity_captured_idx ON token_popularity_history(captured_at DESC);
CREATE INDEX IF NOT EXISTS token_popularity_tier_window_idx ON token_popularity_history(user_tier, window_label, captured_at DESC);
ALTER TABLE token_popularity_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_popularity" ON token_popularity_history;
CREATE POLICY "anyone_reads_popularity" ON token_popularity_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_popularity" ON token_popularity_history;
CREATE POLICY "service_role_popularity" ON token_popularity_history FOR ALL TO service_role USING (true);

-- token_risk_scores: GoPlus risk scan results, refreshed every 2h
CREATE TABLE IF NOT EXISTS token_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  risk_score INT CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'critical')),
  risk_reasons JSONB,
  goplus_raw JSONB,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_address, chain)
);
CREATE INDEX IF NOT EXISTS token_risk_scanned_idx ON token_risk_scores(scanned_at DESC);
ALTER TABLE token_risk_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_risk_scores" ON token_risk_scores;
CREATE POLICY "anyone_reads_risk_scores" ON token_risk_scores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_risk_scores" ON token_risk_scores;
CREATE POLICY "service_role_risk_scores" ON token_risk_scores FOR ALL TO service_role USING (true);

-- cron_execution_log: observability for scheduled jobs
CREATE TABLE IF NOT EXISTS cron_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
  duration_ms INTEGER,
  error_message TEXT,
  items_processed INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS cron_log_name_started_idx ON cron_execution_log(cron_name, started_at DESC);
CREATE INDEX IF NOT EXISTS cron_log_status_idx ON cron_execution_log(status, started_at DESC);
ALTER TABLE cron_execution_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_cron_log" ON cron_execution_log;
CREATE POLICY "service_role_cron_log" ON cron_execution_log FOR ALL TO service_role USING (true);
