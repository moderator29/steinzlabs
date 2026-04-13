-- Auth rate limits table
-- Run in Supabase SQL editor or via MCP execute_sql

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id            BIGSERIAL PRIMARY KEY,
  key           TEXT        NOT NULL,
  ip            TEXT        NOT NULL,
  identifier    TEXT,
  action        TEXT        NOT NULL DEFAULT 'auth',
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_key ON auth_rate_limits (key);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_ip ON auth_rate_limits (ip);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_attempted_at ON auth_rate_limits (attempted_at);

-- Auto-clean old records (older than 2 hours)
CREATE OR REPLACE FUNCTION cleanup_auth_rate_limits()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM auth_rate_limits
  WHERE attempted_at < now() - INTERVAL '2 hours'
    AND (blocked_until IS NULL OR blocked_until < now());
END;
$$;

-- RLS: only service role can access
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON auth_rate_limits
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
