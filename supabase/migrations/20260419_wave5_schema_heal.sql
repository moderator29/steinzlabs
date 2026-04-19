-- Wave 5 — schema heal pass
--
-- 1. Creates 7 tables the app queries but which no prior migration defined.
--    Without these, the matching API routes were returning 500s silently.
-- 2. Enables RLS with a safe default (service-role only) on 9 tables that
--    had none.
-- 3. Adds the 2 filter-column indexes code grep flagged as missing.
--
-- Everything is IF NOT EXISTS / DROP POLICY IF EXISTS so this is safe to
-- re-apply — no destructive operations.

-- ─── 1. MISSING TABLES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  body            text NOT NULL,
  type            text NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','critical','promo')),
  active          boolean NOT NULL DEFAULT true,
  target_audience text NOT NULL DEFAULT 'All',
  expires_at      timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_active_idx ON public.announcements (active);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON public.announcements (created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  subject    text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  type       text NOT NULL DEFAULT 'transactional',
  active     boolean NOT NULL DEFAULT true,
  variables  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.featured_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol        text NOT NULL,
  name          text NOT NULL,
  chain         text NOT NULL,
  address       text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  badge         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS featured_tokens_order_idx ON public.featured_tokens (display_order, active);

CREATE TABLE IF NOT EXISTS public.login_activity (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent text,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_activity_user_created_idx ON public.login_activity (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  feature    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, feature)
);
CREATE INDEX IF NOT EXISTS waitlist_feature_idx ON public.waitlist (feature, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whale_addresses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address    text NOT NULL,
  chain      text NOT NULL,
  label      text NOT NULL,
  category   text,
  notes      text,
  verified   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (address, chain)
);
CREATE INDEX IF NOT EXISTS whale_addresses_chain_idx ON public.whale_addresses (chain);

-- ─── 2. RLS — enable + safe default (service-role only) on backend-only tables ──

ALTER TABLE public.announcements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whale_addresses  ENABLE ROW LEVEL SECURITY;

-- announcements: any authenticated user can read active ones; service-role manages.
DROP POLICY IF EXISTS "announcements_read_active" ON public.announcements;
CREATE POLICY "announcements_read_active" ON public.announcements
  FOR SELECT TO authenticated USING (active = true);
DROP POLICY IF EXISTS "announcements_service" ON public.announcements;
CREATE POLICY "announcements_service" ON public.announcements
  FOR ALL TO service_role USING (true);

-- email_templates / featured_tokens / whale_addresses: admin-managed via service-role only.
DROP POLICY IF EXISTS "email_templates_service" ON public.email_templates;
CREATE POLICY "email_templates_service" ON public.email_templates FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "featured_tokens_read_active" ON public.featured_tokens;
CREATE POLICY "featured_tokens_read_active" ON public.featured_tokens
  FOR SELECT TO authenticated USING (active = true);
DROP POLICY IF EXISTS "featured_tokens_service" ON public.featured_tokens;
CREATE POLICY "featured_tokens_service" ON public.featured_tokens FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "whale_addresses_read" ON public.whale_addresses;
CREATE POLICY "whale_addresses_read" ON public.whale_addresses
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "whale_addresses_service" ON public.whale_addresses;
CREATE POLICY "whale_addresses_service" ON public.whale_addresses FOR ALL TO service_role USING (true);

-- login_activity: user-scoped.
DROP POLICY IF EXISTS "login_activity_own" ON public.login_activity;
CREATE POLICY "login_activity_own" ON public.login_activity
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "login_activity_service" ON public.login_activity;
CREATE POLICY "login_activity_service" ON public.login_activity FOR ALL TO service_role USING (true);

-- user_preferences: user-scoped.
DROP POLICY IF EXISTS "user_preferences_own" ON public.user_preferences;
CREATE POLICY "user_preferences_own" ON public.user_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_preferences_service" ON public.user_preferences;
CREATE POLICY "user_preferences_service" ON public.user_preferences FOR ALL TO service_role USING (true);

-- waitlist: anyone can submit (insert), only service-role can read.
DROP POLICY IF EXISTS "waitlist_insert_anyone" ON public.waitlist;
CREATE POLICY "waitlist_insert_anyone" ON public.waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "waitlist_service" ON public.waitlist;
CREATE POLICY "waitlist_service" ON public.waitlist FOR ALL TO service_role USING (true);

-- ─── 3. RLS for the 9 previously-unprotected tables (from code audit) ────────
-- Each defaults to service-role only — these are backend-populated tables. If
-- any of them eventually need user SELECT, open them up later with a scoped
-- policy; default-closed is the safer starting point.

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
      'fee_revenue','holder_snapshots','push_delivery_log','revenue_records',
      'smart_money_wallets','threats','wallet_cluster_members',
      'wallet_clusters','wallet_profiles'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t)
    THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_service" ON public.%I;', t, t);
      EXECUTE format('CREATE POLICY "%s_service" ON public.%I FOR ALL TO service_role USING (true);', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── 4. MISSING INDEXES ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS profiles_created_at_idx       ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_clusters_user_id_idx   ON public.wallet_clusters (user_id);
