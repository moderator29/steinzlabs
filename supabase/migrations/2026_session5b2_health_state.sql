-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — health state for admin alerting
--
-- Stores the last-known status of every infrastructure check + the
-- Telegram chat IDs that should receive degradation alerts. The
-- health-watch cron compares each check's current status against the
-- previous and sends a notification on transition (e.g. active → error).
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS health_check_state (
  check_name TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'warning', 'error', 'inactive')),
  latency_ms INTEGER,
  message TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS health_check_state_status_idx
  ON health_check_state(status) WHERE status <> 'active';

ALTER TABLE health_check_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_health_state" ON health_check_state;
CREATE POLICY "service_role_health_state" ON health_check_state
  FOR ALL TO service_role USING (true);

-- Admin Telegram alert recipients. Insert your Telegram chat ID after the
-- /start flow with the bot. Multiple admins supported.
CREATE TABLE IF NOT EXISTS health_alert_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL UNIQUE,
  label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE health_alert_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_health_recipients" ON health_alert_recipients;
CREATE POLICY "service_role_health_recipients" ON health_alert_recipients
  FOR ALL TO service_role USING (true);

-- Quick-add SQL to register yourself as a recipient after /link with the bot:
--   INSERT INTO health_alert_recipients (telegram_chat_id, label)
--   VALUES ('123456789', 'phantomfcalls')
--   ON CONFLICT (telegram_chat_id) DO NOTHING;
