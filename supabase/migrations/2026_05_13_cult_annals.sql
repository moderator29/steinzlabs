-- Phase F: Sanctum / The Annals.
--
-- Achievements forged into the cult record. Two tables: a catalog of
-- achievement codes (cult_achievements) and a join of awarded entries
-- per member (cult_member_achievements). v1 ships the catalog + read +
-- a Chosen-only grant path; automatic trigger evaluation (e.g. cult-
-- resolve-proposals fires "voted on every active motion") is a future
-- pass — the grant API is intentionally separated so the trigger can
-- call it without re-implementing the duplicate-check.

CREATE TABLE IF NOT EXISTS cult_achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{3,48}$'),
  title       text NOT NULL CHECK (length(title) BETWEEN 3 AND 80),
  description text NOT NULL CHECK (length(description) BETWEEN 6 AND 280),
  tier        text NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'mythic')),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cult_achievements_tier_idx
  ON cult_achievements (tier, created_at DESC);

CREATE TABLE IF NOT EXISTS cult_member_achievements (
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES cult_achievements(id) ON DELETE CASCADE,
  earned_at      timestamptz NOT NULL DEFAULT now(),
  granted_by     uuid REFERENCES profiles(id),
  note           text CHECK (note IS NULL OR length(note) <= 280),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS cult_member_achievements_earned_idx
  ON cult_member_achievements (user_id, earned_at DESC);

ALTER TABLE cult_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cult_member_achievements ENABLE ROW LEVEL SECURITY;

-- Catalog: every cult member can read active achievements. Writes
-- service-role only (admin tool / migration seed).
DROP POLICY IF EXISTS cult_achievements_read ON cult_achievements;
CREATE POLICY cult_achievements_read ON cult_achievements
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Awarded rows: any cult member can read all awarded entries so the
-- Sanctum can display "who else has this" on each row. A user can read
-- their own awarded rows even when the catalog row is inactive.
DROP POLICY IF EXISTS cult_member_achievements_read ON cult_member_achievements;
CREATE POLICY cult_member_achievements_read ON cult_member_achievements
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Grant: Chosen-only. Trigger crons run with service-role and bypass RLS.
DROP POLICY IF EXISTS cult_member_achievements_grant ON cult_member_achievements;
CREATE POLICY cult_member_achievements_grant ON cult_member_achievements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tier = 'naka_cult' AND p.is_chosen = true
    )
  );

-- Seed the starter set so the chamber renders something on day one.
INSERT INTO cult_achievements (code, title, description, tier)
VALUES
  ('first_seal_read',  'First Seal',     'Broke the wax on your first Daily Seal.',                              'bronze'),
  ('conclave_voter',   'Voice of the Cult', 'Cast a vote in a Conclave proposal.',                                'bronze'),
  ('chosen_seal_written', 'Hand of the Oracle', 'Authored a Daily Seal accepted by the cult.',                    'gold'),
  ('whisper_echoed',   'Carried Forward', 'A whisper you submitted was echoed by the cult.',                     'silver'),
  ('sanctum_listener', 'Long Listener',   'Listened through a full Ddergo Sanctuary track in the Sanctum.',      'bronze'),
  ('vault_year_one',   'Founding Lineage', 'A member of the cult in its founding year.',                          'mythic')
ON CONFLICT (code) DO NOTHING;
