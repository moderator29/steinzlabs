-- Platform-wide counters shown on the landing page. Single-row table;
-- Increments come from swap / scan / security handlers via server-side
-- RPC. RLS allows public SELECT so the landing page can read without auth.

CREATE TABLE IF NOT EXISTS platform_stats (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  tokens_analyzed  BIGINT NOT NULL DEFAULT 0,
  rugs_detected    BIGINT NOT NULL DEFAULT 0,
  swaps_protected  BIGINT NOT NULL DEFAULT 0,
  chains_supported INTEGER NOT NULL DEFAULT 7,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id = 1)
);

-- Seed a single row; subsequent UPDATEs increment the counters.
INSERT INTO platform_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_stats_public_read"
  ON platform_stats FOR SELECT
  USING (true);

CREATE POLICY "platform_stats_service_write"
  ON platform_stats FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- Atomic increment helper. Called from server routes after a real event
-- (successful swap, blocked rug, completed scan) to keep the counters
-- honest and race-safe under concurrent load.
CREATE OR REPLACE FUNCTION increment_platform_stat(stat_name TEXT, delta BIGINT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE stat_name
    WHEN 'tokens_analyzed'  THEN UPDATE platform_stats SET tokens_analyzed  = tokens_analyzed  + delta, updated_at = NOW() WHERE id = 1;
    WHEN 'rugs_detected'    THEN UPDATE platform_stats SET rugs_detected    = rugs_detected    + delta, updated_at = NOW() WHERE id = 1;
    WHEN 'swaps_protected'  THEN UPDATE platform_stats SET swaps_protected  = swaps_protected  + delta, updated_at = NOW() WHERE id = 1;
    ELSE RAISE EXCEPTION 'Unknown platform stat: %', stat_name;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION increment_platform_stat(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_platform_stat(TEXT, BIGINT) TO service_role;
