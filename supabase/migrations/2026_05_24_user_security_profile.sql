-- SC1: composite 0–100 security health score per user, cached so we don't
-- recompute on every dashboard load. Recomputed by /api/security/health
-- on demand and any time a user mutates approvals / claims a chosen badge.
CREATE TABLE IF NOT EXISTS public.user_security_profile (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  health_score       int NOT NULL DEFAULT 0 CHECK (health_score BETWEEN 0 AND 100),
  reputation_score   int NOT NULL DEFAULT 0,
  approval_risk      int NOT NULL DEFAULT 0,
  threat_count       int NOT NULL DEFAULT 0,
  honeypot_count     int NOT NULL DEFAULT 0,
  breach_count       int NOT NULL DEFAULT 0,
  last_breach_check  timestamptz,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS user_security_profile_score_idx
  ON public.user_security_profile (health_score);

ALTER TABLE public.user_security_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_security_profile_select_own
  ON public.user_security_profile FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
