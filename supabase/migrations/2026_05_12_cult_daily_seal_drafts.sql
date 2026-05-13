-- Chosen-authored Daily Seal drafts.
--
-- Phase F: members with profiles.is_chosen = true can author next-day Daily
-- Seals instead of letting Anthropic auto-generate. The cult-generate-daily-seal
-- cron consumes the most-recent pending draft for tomorrow before falling back
-- to the model.
--
-- Drafts live in their own table (not as a flag on cult_daily_seals) so the
-- generation history stays append-only and we can audit who authored what
-- without UPSERT churn on the seals table.

CREATE TABLE IF NOT EXISTS cult_daily_seal_drafts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_date    date NOT NULL,
  author_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text NOT NULL CHECK (length(title) BETWEEN 6 AND 140),
  body         text NOT NULL CHECK (length(body) BETWEEN 60 AND 4000),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS cult_daily_seal_drafts_target_idx
  ON cult_daily_seal_drafts (seal_date, status, created_at DESC);

CREATE INDEX IF NOT EXISTS cult_daily_seal_drafts_author_idx
  ON cult_daily_seal_drafts (author_id, created_at DESC);

ALTER TABLE cult_daily_seal_drafts ENABLE ROW LEVEL SECURITY;

-- Read: every naka_cult member can see drafts so the Oracle chamber can
-- display "tomorrow's seal: drafted by X" before the cron consumes it.
DROP POLICY IF EXISTS cult_daily_seal_drafts_read ON cult_daily_seal_drafts;
CREATE POLICY cult_daily_seal_drafts_read ON cult_daily_seal_drafts
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Write: only Chosen members may insert, and only as themselves. The API
-- route still enforces this server-side via getCultAccess; RLS is defense
-- in depth in case service-role wiring ever breaks.
DROP POLICY IF EXISTS cult_daily_seal_drafts_insert ON cult_daily_seal_drafts;
CREATE POLICY cult_daily_seal_drafts_insert ON cult_daily_seal_drafts
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tier = 'naka_cult'
        AND p.is_chosen = true
    )
  );

-- Update: author can edit their own draft while still pending. Acceptance /
-- rejection happens server-side via service-role (cron or admin tool).
DROP POLICY IF EXISTS cult_daily_seal_drafts_update_self ON cult_daily_seal_drafts;
CREATE POLICY cult_daily_seal_drafts_update_self ON cult_daily_seal_drafts
  FOR UPDATE USING (
    auth.uid() = author_id AND status = 'pending'
  ) WITH CHECK (
    auth.uid() = author_id
  );
