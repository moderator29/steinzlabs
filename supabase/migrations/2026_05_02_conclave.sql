-- The Conclave — proposals + votes + treasury snapshots.
-- Phase 5 of the Vault build.

-- A proposal is a Decree, a Whisper-promotion, or a treasury motion
-- raised by a cult member. Statuses progress
--   active → passed | failed | executed | cancelled
-- by the resolution job (cult_resolve_proposals, ships next pass).
CREATE TABLE IF NOT EXISTS cult_proposals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('decree', 'whisper', 'treasury')),
  title         text NOT NULL CHECK (length(title) BETWEEN 6 AND 140),
  body          text NOT NULL CHECK (length(body)  BETWEEN 30 AND 5000),
  -- Stake the author put up to surface the proposal. Real economic
  -- skin-in-the-game gates spam without requiring an admin queue.
  stake_naka    numeric(20, 2) NOT NULL DEFAULT 0 CHECK (stake_naka >= 0),
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'passed', 'failed', 'executed', 'cancelled')),
  yes_weight    numeric(28, 2) NOT NULL DEFAULT 0,
  no_weight     numeric(28, 2) NOT NULL DEFAULT 0,
  abstain_weight numeric(28, 2) NOT NULL DEFAULT 0,
  voter_count   integer NOT NULL DEFAULT 0,
  ends_at       timestamptz NOT NULL,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cult_proposals_status_ends_idx
  ON cult_proposals (status, ends_at DESC);

ALTER TABLE cult_proposals ENABLE ROW LEVEL SECURITY;

-- Read: any cult member can read proposals.
DROP POLICY IF EXISTS cult_proposals_read ON cult_proposals;
CREATE POLICY cult_proposals_read ON cult_proposals
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Write: server-only via the service-role API route, never client.
-- (No client-callable INSERT policy on purpose — we want the API route
-- to validate stake balance + body length + kind before accepting.)

-- Votes — one per (proposal, user). Weight is captured at vote time
-- so retroactive balance changes don't reweight the bar.
CREATE TABLE IF NOT EXISTS cult_proposal_votes (
  proposal_id   uuid NOT NULL REFERENCES cult_proposals(id) ON DELETE CASCADE,
  voter_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice        text NOT NULL CHECK (choice IN ('yes', 'no', 'abstain')),
  weight        numeric(28, 2) NOT NULL CHECK (weight >= 0),
  is_chosen     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, voter_id)
);

CREATE INDEX IF NOT EXISTS cult_votes_proposal_idx
  ON cult_proposal_votes (proposal_id, created_at DESC);

ALTER TABLE cult_proposal_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cult_votes_read ON cult_proposal_votes;
CREATE POLICY cult_votes_read ON cult_proposal_votes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Threaded comments under a proposal. Free-form discussion area.
CREATE TABLE IF NOT EXISTS cult_proposal_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES cult_proposals(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES cult_proposal_comments(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cult_comments_proposal_idx
  ON cult_proposal_comments (proposal_id, created_at);

ALTER TABLE cult_proposal_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cult_comments_read ON cult_proposal_comments;
CREATE POLICY cult_comments_read ON cult_proposal_comments
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

DROP POLICY IF EXISTS cult_comments_insert ON cult_proposal_comments;
CREATE POLICY cult_comments_insert ON cult_proposal_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

-- Treasury snapshot — periodic balance + cumulative inflows/outflows.
-- One row per snapshot; latest row is the live treasury state. Backfill
-- + scheduled refresh is owner-action via the on-chain treasury wallet.
CREATE TABLE IF NOT EXISTS cult_treasury_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_naka    numeric(28, 2),
  balance_usd     numeric(20, 2),
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'alchemy', 'helius', 'rpc')),
  notes           text,
  captured_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cult_treasury_captured_idx
  ON cult_treasury_snapshots (captured_at DESC);

ALTER TABLE cult_treasury_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cult_treasury_read ON cult_treasury_snapshots;
CREATE POLICY cult_treasury_read ON cult_treasury_snapshots
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );

DROP POLICY IF EXISTS cult_treasury_admin_write ON cult_treasury_snapshots;
CREATE POLICY cult_treasury_admin_write ON cult_treasury_snapshots
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Refresh the cult_stats view to use real decrees_passed count.
CREATE OR REPLACE VIEW cult_stats AS
SELECT
  (SELECT count(*)::bigint FROM profiles WHERE tier = 'naka_cult')         AS active_members,
  (SELECT count(*)::bigint FROM profiles WHERE is_chosen = true)            AS chosen_count,
  null::numeric                                                              AS total_naka_held,
  (SELECT count(*)::bigint FROM cult_proposals WHERE status IN ('passed','executed') AND kind = 'decree') AS decrees_passed;

GRANT SELECT ON cult_stats TO authenticated;
