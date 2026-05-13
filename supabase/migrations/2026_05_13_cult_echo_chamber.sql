-- Phase F: Oracle / Echo Chamber.
--
-- Twenty-five communal stealth-wallet slots only the cult can see. Chosen
-- members curate the list; the rest of the cult reads it. The slot count is
-- hard-capped via a unique partial index (one row per position 1..25 while
-- active) and a CHECK on the column itself.
--
-- v1 stores wallets as plain rows. Live holdings enrichment (Alchemy /
-- Helius per slot) is intentionally not wired here — it would N+1 the view.
-- A follow-up cron can backfill cached USD totals on the row itself.

CREATE TABLE IF NOT EXISTS cult_echo_wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position    integer NOT NULL CHECK (position BETWEEN 1 AND 25),
  address     text NOT NULL CHECK (length(address) BETWEEN 6 AND 100),
  chain       text NOT NULL CHECK (length(chain) BETWEEN 2 AND 32),
  label       text CHECK (label IS NULL OR length(label) BETWEEN 1 AND 80),
  notes       text CHECK (notes IS NULL OR length(notes) <= 280),
  added_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  active      boolean NOT NULL DEFAULT true
);

-- One active wallet per position 1..25 — guarantees the hard cap on slots
-- without a separate counter. Removed rows flip active=false so the audit
-- trail stays intact and a future re-add can reuse the slot.
CREATE UNIQUE INDEX IF NOT EXISTS cult_echo_wallets_position_active_uidx
  ON cult_echo_wallets (position)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS cult_echo_wallets_added_at_idx
  ON cult_echo_wallets (added_at DESC);

ALTER TABLE cult_echo_wallets ENABLE ROW LEVEL SECURITY;

-- Read: any naka_cult member.
DROP POLICY IF EXISTS cult_echo_wallets_read ON cult_echo_wallets;
CREATE POLICY cult_echo_wallets_read ON cult_echo_wallets
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Insert / update / delete: Chosen members only. The API still guards on
-- getCultAccess().isChosen; RLS is defense-in-depth.
DROP POLICY IF EXISTS cult_echo_wallets_insert ON cult_echo_wallets;
CREATE POLICY cult_echo_wallets_insert ON cult_echo_wallets
  FOR INSERT WITH CHECK (
    auth.uid() = added_by
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tier = 'naka_cult' AND p.is_chosen = true
    )
  );

DROP POLICY IF EXISTS cult_echo_wallets_update ON cult_echo_wallets;
CREATE POLICY cult_echo_wallets_update ON cult_echo_wallets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tier = 'naka_cult' AND p.is_chosen = true
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tier = 'naka_cult' AND p.is_chosen = true
    )
  );
