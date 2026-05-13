-- Phase F: Chosen members may curate the Sanctum Library.
--
-- The cult_ambient_tracks table existed since vault_foundation but only
-- admins could write. This migration adds two scoped policies that let a
-- Chosen member reorder (display_order) and soft-delete (is_active=false)
-- tracks. Insert + hard-delete remain admin-only because adding new audio
-- requires a storage path the cult shouldn't be able to forge.

DROP POLICY IF EXISTS cult_ambient_chosen_update ON cult_ambient_tracks;
CREATE POLICY cult_ambient_chosen_update ON cult_ambient_tracks
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tier = 'naka_cult'
        AND p.is_chosen = true
    )
  ) WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tier = 'naka_cult'
        AND p.is_chosen = true
    )
  );

-- Audit trail: who last touched what. Adding nullable columns is safe and
-- keeps existing inserts working without a default.
ALTER TABLE cult_ambient_tracks
  ADD COLUMN IF NOT EXISTS curated_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS curated_at timestamptz;

CREATE INDEX IF NOT EXISTS cult_ambient_tracks_curator_idx
  ON cult_ambient_tracks (curated_by, curated_at DESC);
