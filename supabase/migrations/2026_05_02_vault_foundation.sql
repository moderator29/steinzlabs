-- Vault foundation tables.
-- Phase 4 — minimal scaffold for /vault entry, identity, and ambient.
-- Subsequent phases (Conclave / Oracle / Sanctum / Chosen) extend
-- with proposal / votes / whispers / customizations / etc.

-- The Chosen Seal flag on profiles. Mirrored from on-chain NakaLabs
-- Development NFT ownership; persisted so we don't re-check the chain
-- on every page load. A future cron resolves it; for now, owner-set.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_chosen boolean NOT NULL DEFAULT false;

-- Per-user Vault preferences. Sound on/off, ambient music on/off,
-- volume levels, vault entry theme, has-seen-entry-cinematic flag.
-- localStorage keeps a session-fast copy; the row is the source of
-- truth across devices.
CREATE TABLE IF NOT EXISTS cult_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sound_enabled boolean NOT NULL DEFAULT true,
  sound_volume numeric(3,2) NOT NULL DEFAULT 0.40 CHECK (sound_volume >= 0 AND sound_volume <= 1),
  music_enabled boolean NOT NULL DEFAULT true,
  music_volume numeric(3,2) NOT NULL DEFAULT 0.15 CHECK (music_volume >= 0 AND music_volume <= 1),
  vault_entry_theme text NOT NULL DEFAULT 'default' CHECK (vault_entry_theme IN ('default','crimson','aurora','minimal')),
  has_seen_entry_cinematic boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cult_user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cult_prefs_select_self ON cult_user_preferences;
CREATE POLICY cult_prefs_select_self ON cult_user_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS cult_prefs_upsert_self ON cult_user_preferences;
CREATE POLICY cult_prefs_upsert_self ON cult_user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS cult_prefs_update_self ON cult_user_preferences;
CREATE POLICY cult_prefs_update_self ON cult_user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Ambient track catalog for the Vault mini-player. Owner curates the
-- list; clients pick a random track on entry. Storing track URLs in a
-- table (not hardcoded) means new tracks can be added without a deploy.
CREATE TABLE IF NOT EXISTS cult_ambient_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL DEFAULT 'Ddergo',
  storage_path text NOT NULL,
  duration_seconds integer,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cult_ambient_tracks ENABLE ROW LEVEL SECURITY;

-- Public read for any authenticated cult member; writes admin-only.
DROP POLICY IF EXISTS cult_ambient_select_authed ON cult_ambient_tracks;
CREATE POLICY cult_ambient_select_authed ON cult_ambient_tracks
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admin write policies follow the existing is_admin() helper introduced
-- in session_d_part1_helpers_and_admin.
DROP POLICY IF EXISTS cult_ambient_admin_write ON cult_ambient_tracks;
CREATE POLICY cult_ambient_admin_write ON cult_ambient_tracks
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Aggregated read view for the Vault's "THE CULT" stat strip. Counts
-- cult members and tallies summed $NAKA holdings across known wallets.
-- Holdings are stubbed for now (real wallet-balance aggregation lands
-- with the on-chain access resolver) — exposed as null when unknown so
-- the UI renders an empty-state cell rather than a fake number.
CREATE OR REPLACE VIEW cult_stats AS
SELECT
  (SELECT count(*)::bigint FROM profiles WHERE tier = 'naka_cult') AS active_members,
  (SELECT count(*)::bigint FROM profiles WHERE is_chosen = true)   AS chosen_count,
  null::numeric                                                    AS total_naka_held,
  0::bigint                                                        AS decrees_passed; -- Conclave (phase 5) replaces this column

GRANT SELECT ON cult_stats TO authenticated;
