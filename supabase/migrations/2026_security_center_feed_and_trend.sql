-- Security Center: live threat feed + health-score trend + monitoring opt-in.
--
-- Three additive, idempotent pieces:
--   1. security_alerts               real per-user threat feed rows (severity/source/time)
--   2. user_security_profile_history append-only snapshots so the health score
--                                    can show a genuine trend over time (the live
--                                    user_security_profile table is single-row per
--                                    user via upsert, so it holds no history itself)
--   3. user_security_settings        per-user opt-in monitoring toggle
--
-- Nothing here is backfilled with synthetic data. The feed and trend render
-- honest empty / single-snapshot states until real rows accrue.

-- 1. Live threat feed --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity    text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'warn')),
  title       text NOT NULL,
  description text,
  source      text,               -- upstream provider: GoPlus, Alchemy, Helius, OFAC, …
  category    text,               -- approval | honeypot | sanctions | phishing | wallet | contract
  target      text,               -- address / domain / tx the alert concerns
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_alerts_user_created_idx
  ON public.security_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_alerts_user_severity_idx
  ON public.security_alerts (user_id, severity);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_alerts'
      AND policyname = 'security_alerts_select_own'
  ) THEN
    CREATE POLICY security_alerts_select_own
      ON public.security_alerts FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_alerts'
      AND policyname = 'security_alerts_update_own'
  ) THEN
    -- Owners may acknowledge their own alerts; service role writes new rows.
    CREATE POLICY security_alerts_update_own
      ON public.security_alerts FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 2. Health-score history (append-only) --------------------------------------
CREATE TABLE IF NOT EXISTS public.user_security_profile_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_score      int NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  reputation_score  int NOT NULL DEFAULT 0,
  approval_risk     int NOT NULL DEFAULT 0,
  threat_count      int NOT NULL DEFAULT 0,
  honeypot_count    int NOT NULL DEFAULT 0,
  breakdown         jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_security_profile_history_user_time_idx
  ON public.user_security_profile_history (user_id, computed_at DESC);

ALTER TABLE public.user_security_profile_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_security_profile_history'
      AND policyname = 'usp_history_select_own'
  ) THEN
    CREATE POLICY usp_history_select_own
      ON public.user_security_profile_history FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 3. Per-user monitoring opt-in ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_security_settings (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monitoring_enabled  boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_security_settings'
      AND policyname = 'user_security_settings_select_own'
  ) THEN
    CREATE POLICY user_security_settings_select_own
      ON public.user_security_settings FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_security_settings'
      AND policyname = 'user_security_settings_upsert_own'
  ) THEN
    CREATE POLICY user_security_settings_upsert_own
      ON public.user_security_settings FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
