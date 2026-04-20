-- Bug §6.2: scheduled research publishing.
-- Adds a scheduled_at column + partial index so the publish-scheduled-research
-- cron can cheaply find draft posts whose publish time has arrived.
--
-- No existing rows are modified; scheduled_at defaults to NULL meaning
-- "not scheduled — publish manually". The cron only flips rows where
-- status='draft' AND scheduled_at IS NOT NULL AND scheduled_at <= now().

ALTER TABLE IF EXISTS research_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Partial index: only rows that are actually queued for publishing. Keeps
-- the index tiny (most rows won't have scheduled_at set) while making the
-- cron's WHERE clause a single-digit-ms lookup.
CREATE INDEX IF NOT EXISTS idx_research_posts_scheduled_due
  ON research_posts (scheduled_at)
  WHERE status = 'draft' AND scheduled_at IS NOT NULL;
