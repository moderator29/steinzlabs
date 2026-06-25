-- Three tables the code already reads/writes but were never created live, so
-- the composite-alerts builder, the alert-template picker, and the per-user
-- notification channels (Discord webhook / Twilio SMS) all silently no-op.
-- Schemas match exactly what the routes + alert-monitor cron expect.

-- ── composite_alerts ────────────────────────────────────────────────────────
-- app/api/alerts/composite (GET/POST) + app/api/cron/alert-monitor + tierLimits
CREATE TABLE IF NOT EXISTS public.composite_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  expression        jsonb NOT NULL,
  cooldown_seconds  integer NOT NULL DEFAULT 300,
  active            boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS composite_alerts_user_idx ON public.composite_alerts (user_id);
CREATE INDEX IF NOT EXISTS composite_alerts_active_idx ON public.composite_alerts (active) WHERE active;
ALTER TABLE public.composite_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS composite_alerts_select_own ON public.composite_alerts;
CREATE POLICY composite_alerts_select_own ON public.composite_alerts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS composite_alerts_insert_own ON public.composite_alerts;
CREATE POLICY composite_alerts_insert_own ON public.composite_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS composite_alerts_update_own ON public.composite_alerts;
CREATE POLICY composite_alerts_update_own ON public.composite_alerts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS composite_alerts_delete_own ON public.composite_alerts;
CREATE POLICY composite_alerts_delete_own ON public.composite_alerts FOR DELETE USING (auth.uid() = user_id);

-- ── alert_templates ─────────────────────────────────────────────────────────
-- app/api/alerts/templates (GET) — public read-only catalog of recipes
CREATE TABLE IF NOT EXISTS public.alert_templates (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text NOT NULL UNIQUE,
  title                    text NOT NULL,
  description              text,
  category                 text NOT NULL,
  expression               jsonb NOT NULL,
  default_cooldown_seconds integer NOT NULL DEFAULT 300,
  created_at               timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alert_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alert_templates_public_read ON public.alert_templates;
CREATE POLICY alert_templates_public_read ON public.alert_templates FOR SELECT USING (true);
-- Seed only PRICE-predicate starters — the only predicate type the evaluator
-- (lib/alerts/evaluateComposite.ts) currently resolves; whale/velocity/etc.
-- return cold until those data surfaces are wired, so seeding them would ship
-- non-functional recipes. These are customizable scaffolds (user sets the
-- token + threshold in the builder), not fabricated data.
INSERT INTO public.alert_templates (slug, title, description, category, expression, default_cooldown_seconds) VALUES
  ('price-breakout-above', 'Price breaks above', 'Fires when a token you choose trades above your target price.', 'Price',
   '{"type":"price","direction":"above"}'::jsonb, 300),
  ('price-breakdown-below', 'Price drops below', 'Fires when a token you choose trades below your target price.', 'Price',
   '{"type":"price","direction":"below"}'::jsonb, 300),
  ('price-range-break', 'Either side of a range', 'Fires when price breaks above OR below the levels you set.', 'Price',
   '{"op":"OR","children":[{"type":"price","direction":"above"},{"type":"price","direction":"below"}]}'::jsonb, 600)
ON CONFLICT (slug) DO NOTHING;

-- ── user_notification_channels ──────────────────────────────────────────────
-- app/api/notifications/channels (GET/PUT) + lib/notifications/channels fan-out
CREATE TABLE IF NOT EXISTS public.user_notification_channels (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_webhook  text,
  discord_enabled  boolean NOT NULL DEFAULT false,
  sms_phone        text,
  sms_enabled      boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_notification_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unc_select_own ON public.user_notification_channels;
CREATE POLICY unc_select_own ON public.user_notification_channels FOR SELECT USING (auth.uid() = user_id);
