-- Wave 5 v3 — applied to Supabase on 2026-04-19 via MCP.
--
-- Non-destructive heal of the schema drift surfaced by the code-vs-migration
-- audit. ALTER TABLE ADD COLUMN IF NOT EXISTS for every missing column on
-- pre-existing tables (announcements, email_templates, featured_tokens,
-- whale_addresses); CREATE TABLE IF NOT EXISTS for the two that didn't
-- exist (user_preferences, waitlist). Backfills the new columns from the
-- legacy equivalents so both old and new code paths work. Enables RLS +
-- safe default policies on every touched table plus the 9 legacy tables
-- that had no RLS at all. No drops.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS title           text,
  ADD COLUMN IF NOT EXISTS body            text,
  ADD COLUMN IF NOT EXISTS active          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS target_audience text DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();
UPDATE public.announcements SET body = message WHERE body IS NULL AND message IS NOT NULL;
UPDATE public.announcements SET active = is_active WHERE active IS NULL;
UPDATE public.announcements SET target_audience = target WHERE target_audience = 'All' AND target IS NOT NULL;
CREATE INDEX IF NOT EXISTS announcements_active_idx ON public.announcements (active);

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS body       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS type       text DEFAULT 'transactional',
  ADD COLUMN IF NOT EXISTS active     boolean DEFAULT true;
UPDATE public.email_templates SET body = COALESCE(text_body, html_body, '') WHERE body = '' OR body IS NULL;

ALTER TABLE public.featured_tokens
  ADD COLUMN IF NOT EXISTS symbol        text,
  ADD COLUMN IF NOT EXISTS name          text,
  ADD COLUMN IF NOT EXISTS address       text,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS badge         text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();
UPDATE public.featured_tokens SET address = token_address WHERE address IS NULL AND token_address IS NOT NULL;
UPDATE public.featured_tokens SET name    = display_name  WHERE name    IS NULL AND display_name IS NOT NULL;
UPDATE public.featured_tokens SET display_order = sort_order WHERE display_order = 0 AND sort_order IS NOT NULL;
UPDATE public.featured_tokens SET active  = is_active     WHERE active IS NULL;
CREATE INDEX IF NOT EXISTS featured_tokens_order_idx ON public.featured_tokens (display_order, active);

CREATE INDEX IF NOT EXISTS login_activity_user_created_idx ON public.login_activity (user_id, created_at DESC);

ALTER TABLE public.whale_addresses
  ADD COLUMN IF NOT EXISTS notes      text,
  ADD COLUMN IF NOT EXISTS verified   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS whale_addresses_chain_idx ON public.whale_addresses (chain);

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

ALTER TABLE public.announcements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whale_addresses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_read_active" ON public.announcements;
CREATE POLICY "announcements_read_active" ON public.announcements
  FOR SELECT TO authenticated USING (COALESCE(active, is_active, true) = true);
DROP POLICY IF EXISTS "announcements_service" ON public.announcements;
CREATE POLICY "announcements_service" ON public.announcements FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "email_templates_service" ON public.email_templates;
CREATE POLICY "email_templates_service" ON public.email_templates FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "featured_tokens_read_active" ON public.featured_tokens;
CREATE POLICY "featured_tokens_read_active" ON public.featured_tokens
  FOR SELECT TO authenticated USING (COALESCE(active, is_active, true) = true);
DROP POLICY IF EXISTS "featured_tokens_service" ON public.featured_tokens;
CREATE POLICY "featured_tokens_service" ON public.featured_tokens FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "whale_addresses_read" ON public.whale_addresses;
CREATE POLICY "whale_addresses_read" ON public.whale_addresses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "whale_addresses_service" ON public.whale_addresses;
CREATE POLICY "whale_addresses_service" ON public.whale_addresses FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "login_activity_own" ON public.login_activity;
CREATE POLICY "login_activity_own" ON public.login_activity
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "login_activity_service" ON public.login_activity;
CREATE POLICY "login_activity_service" ON public.login_activity FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "user_preferences_own" ON public.user_preferences;
CREATE POLICY "user_preferences_own" ON public.user_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_preferences_service" ON public.user_preferences;
CREATE POLICY "user_preferences_service" ON public.user_preferences FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "waitlist_insert_anyone" ON public.waitlist;
CREATE POLICY "waitlist_insert_anyone" ON public.waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "waitlist_service" ON public.waitlist;
CREATE POLICY "waitlist_service" ON public.waitlist FOR ALL TO service_role USING (true);

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

CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at DESC);
