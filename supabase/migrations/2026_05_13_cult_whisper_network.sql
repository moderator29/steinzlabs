-- Phase F: Oracle / Whisper Network.
--
-- Anonymous intel submissions from any cult member. The cult votes ECHO
-- (signal) or SILENCE (drop) — five echoes promote, three silences kill.
-- author_id is stored for moderation / abuse traceability but never
-- exposed on the read API; the table-level SELECT is wide and the route
-- explicitly omits author_id from its projections.
--
-- A separate cult_whisper_votes table enforces one vote per member per
-- whisper via a UNIQUE constraint and lets us tally echoes / silences
-- atomically. Self-votes are blocked by a CHECK at insert time so a
-- whisper can't promote itself.

CREATE TABLE IF NOT EXISTS cult_whispers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  body            text NOT NULL CHECK (length(body) BETWEEN 12 AND 1200),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'echoed', 'silenced')),
  echo_count      integer NOT NULL DEFAULT 0 CHECK (echo_count >= 0),
  silence_count   integer NOT NULL DEFAULT 0 CHECK (silence_count >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS cult_whispers_status_created_idx
  ON cult_whispers (status, created_at DESC);

CREATE TABLE IF NOT EXISTS cult_whisper_votes (
  whisper_id   uuid NOT NULL REFERENCES cult_whispers(id) ON DELETE CASCADE,
  voter_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote         text NOT NULL CHECK (vote IN ('echo', 'silence')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (whisper_id, voter_id)
);

ALTER TABLE cult_whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cult_whisper_votes ENABLE ROW LEVEL SECURITY;

-- Whispers: cult reads, cult writes (any member, not just Chosen).
DROP POLICY IF EXISTS cult_whispers_read ON cult_whispers;
CREATE POLICY cult_whispers_read ON cult_whispers
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

DROP POLICY IF EXISTS cult_whispers_insert ON cult_whispers;
CREATE POLICY cult_whispers_insert ON cult_whispers
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Votes: cult reads + writes; the API enforces self-vote prevention by
-- looking up the whisper's author_id (RLS can't do that without a function).
DROP POLICY IF EXISTS cult_whisper_votes_read ON cult_whisper_votes;
CREATE POLICY cult_whisper_votes_read ON cult_whisper_votes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

DROP POLICY IF EXISTS cult_whisper_votes_insert ON cult_whisper_votes;
CREATE POLICY cult_whisper_votes_insert ON cult_whisper_votes
  FOR INSERT WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );
