-- "Ape or Nope" — the cult's daily gut-check game.
--
-- A trending memecoin drops each day; members tap APE 🚀 or NOPE 💀 (one call
-- per round). 24h later the round resolves on real DEX price (via the same
-- conviction price resolver), correct calls earn cult points + a streak, and
-- the result fires a Signal Pulse. RLS on, service-only (API runs the gate).
-- Idempotent.

-- Points + streak live on the profile (read on every vote / leaderboard).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cult_points      integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cult_streak      integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cult_best_streak integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cult_ape_rounds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol            text NOT NULL,
  name              text,
  image_url         text,
  token_address     text,
  pair_ref          text,
  pair_chain        text,
  entry_price_usd   numeric,
  resolve_price_usd numeric,
  move_pct          numeric,
  outcome           text CHECK (outcome IN ('ape','nope','flat')),
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  opened_at         timestamptz NOT NULL DEFAULT now(),
  resolves_at       timestamptz NOT NULL,
  resolved_at       timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cult_ape_rounds_status ON cult_ape_rounds (status, resolves_at);
ALTER TABLE cult_ape_rounds ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cult_ape_votes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id       uuid NOT NULL REFERENCES cult_ape_rounds(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice         text NOT NULL CHECK (choice IN ('ape','nope')),
  correct        boolean,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cult_ape_votes_round ON cult_ape_votes (round_id);
CREATE INDEX IF NOT EXISTS idx_cult_ape_votes_user  ON cult_ape_votes (user_id);
ALTER TABLE cult_ape_votes ENABLE ROW LEVEL SECURITY;
