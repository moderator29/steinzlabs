-- NakaCult — four new member features ("The Commons"):
--   The Hall          — members-only live chat
--   The Offering      — treasury-funded raffles / rewards members enter
--   Conviction Board  — members post on-chain calls, scored on a leaderboard
--   Signal Pulse      — a cult-only on-chain signal stream
--
-- All gated in the API via getCultAccess(); RLS is enabled with NO public
-- policies so only the service-role API path (which runs the cult gate) can
-- touch them. Idempotent.

-- ── The Hall (live chat) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cult_hall_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cult_hall_created ON cult_hall_messages (created_at DESC);
ALTER TABLE cult_hall_messages ENABLE ROW LEVEL SECURITY;

-- ── The Offering (treasury rewards / raffles) ─────────────────────────────
CREATE TABLE IF NOT EXISTS cult_offerings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  description    text,
  kind           text NOT NULL DEFAULT 'raffle' CHECK (kind IN ('raffle','airdrop','reward')),
  status         text NOT NULL DEFAULT 'open'   CHECK (status IN ('open','drawn','closed')),
  reward_label   text,
  closes_at      timestamptz,
  winner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  drawn_at       timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cult_offerings_status ON cult_offerings (status, created_at DESC);
ALTER TABLE cult_offerings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cult_offering_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES cult_offerings(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offering_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cult_offering_entries_offering ON cult_offering_entries (offering_id);
ALTER TABLE cult_offering_entries ENABLE ROW LEVEL SECURITY;

-- ── Conviction Board ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cult_convictions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset       text NOT NULL,
  chain       text,
  direction   text NOT NULL DEFAULT 'long' CHECK (direction IN ('long','short')),
  thesis      text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','scored','closed')),
  score       numeric,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cult_convictions_user ON cult_convictions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cult_convictions_score ON cult_convictions (score DESC NULLS LAST);
ALTER TABLE cult_convictions ENABLE ROW LEVEL SECURITY;

-- ── Signal Pulse (cult-only on-chain signal stream) ───────────────────────
CREATE TABLE IF NOT EXISTS cult_signals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL,
  title      text NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity   text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','watch','alert')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cult_signals_created ON cult_signals (created_at DESC);
ALTER TABLE cult_signals ENABLE ROW LEVEL SECURITY;
