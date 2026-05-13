-- Phase F: Sanctum / The Mantle.
--
-- Cosmetic dressing room. Six slots (avatar / frame / glow / banner / title
-- / sigil), each backed by a catalog of cosmetic assets. v1 ships:
--   - catalog rows the user can equip free (default tier)
--   - per-user "loadout" (one row per slot, FK to a cosmetic)
-- Future passes can gate cosmetics on achievement code or on-chain holdings
-- via the requires_achievement_code column.

CREATE TABLE IF NOT EXISTS cult_cosmetics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot        text NOT NULL CHECK (slot IN ('avatar', 'frame', 'glow', 'banner', 'title', 'sigil')),
  code        text NOT NULL CHECK (code ~ '^[a-z0-9_-]{3,48}$'),
  label       text NOT NULL CHECK (length(label) BETWEEN 2 AND 80),
  asset_url   text CHECK (asset_url IS NULL OR length(asset_url) BETWEEN 1 AND 400),
  preview_color text CHECK (preview_color IS NULL OR length(preview_color) <= 32),
  requires_achievement_code text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot, code)
);

CREATE INDEX IF NOT EXISTS cult_cosmetics_slot_idx ON cult_cosmetics (slot, active);

CREATE TABLE IF NOT EXISTS cult_member_loadouts (
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot        text NOT NULL CHECK (slot IN ('avatar', 'frame', 'glow', 'banner', 'title', 'sigil')),
  cosmetic_id uuid NOT NULL REFERENCES cult_cosmetics(id) ON DELETE CASCADE,
  equipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);

ALTER TABLE cult_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cult_member_loadouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cult_cosmetics_read ON cult_cosmetics;
CREATE POLICY cult_cosmetics_read ON cult_cosmetics
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

DROP POLICY IF EXISTS cult_member_loadouts_own ON cult_member_loadouts;
CREATE POLICY cult_member_loadouts_own ON cult_member_loadouts
  FOR ALL USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  ) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Seed starter cosmetics so the chamber has something to render. Each row
-- uses preview_color so v1 can render swatches without shipping image
-- assets; asset_url backfills once the brand pack lands.
INSERT INTO cult_cosmetics (slot, code, label, preview_color) VALUES
  ('avatar', 'default_sigil',   'Naka Sigil',         '#0066FF'),
  ('avatar', 'oracle_eye',      'Oracle Eye',         '#00C8FF'),
  ('avatar', 'sanctum_flame',   'Sanctum Flame',      '#FFD86B'),
  ('frame',  'default_ring',    'Standard Ring',      '#0066FF'),
  ('frame',  'crimson_ring',    'Crimson Ring',       '#DC143C'),
  ('frame',  'gold_ring',       'Chosen Ring',        '#FFD86B'),
  ('glow',   'none',            'No Glow',            'transparent'),
  ('glow',   'cult_glow',       'Cult Glow',          '#DC143C'),
  ('glow',   'oracle_glow',     'Oracle Glow',        '#00C8FF'),
  ('banner', 'default_navy',    'Deep Navy',          '#050816'),
  ('banner', 'crimson_strip',   'Crimson Strip',      '#DC143C'),
  ('title',  'cult_kin',        'Cult Kin',           NULL),
  ('title',  'oracle_hand',     'Hand of the Oracle', NULL),
  ('title',  'echo_keeper',     'Echo Keeper',        NULL),
  ('sigil',  'pentagon',        'Pentagon',           '#0066FF'),
  ('sigil',  'rocket',          'Rocket',             '#DC143C'),
  ('sigil',  'helmet',          'Helmet',             '#00C8FF')
ON CONFLICT (slot, code) DO NOTHING;
