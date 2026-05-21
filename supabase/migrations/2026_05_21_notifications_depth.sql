-- §3 P2-F notifications depth — schema additions for composite alerts,
-- cooldowns, per-user notification channels, and templates.

-- P2-F.3 cooldown windows on price_alerts (don't fire the same alert
-- twice within N seconds). Existing `triggered` + `triggered_at` already
-- gate the one-shot path; cooldown_seconds gives the alert-monitor cron
-- a re-arm window for ongoing alerts.
ALTER TABLE public.price_alerts
  ADD COLUMN IF NOT EXISTS cooldown_seconds  int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS last_triggered_at timestamptz;

-- P2-F.1 composite_alerts — AND/OR predicates referencing 2+ price_alerts
-- entries (or generalized condition primitives). The alert-monitor cron
-- evaluates the boolean expression and fires when satisfied.
CREATE TABLE IF NOT EXISTS public.composite_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  -- expression is a JSON tree: { op: 'AND'|'OR', children: [<predicate>|<expression>] }
  -- predicate: { type: 'price', symbol, direction, threshold } |
  --            { type: 'velocity', symbol, hours, threshold_pct } |
  --            { type: 'whale_buy', whale_address, min_usd }
  expression      jsonb NOT NULL,
  cooldown_seconds int NOT NULL DEFAULT 300,
  last_triggered_at timestamptz,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS composite_alerts_user_active_idx
  ON public.composite_alerts (user_id) WHERE active = true;

ALTER TABLE public.composite_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "composite_alerts_own"
  ON public.composite_alerts FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- P2-F.6 + P2-F.7 — per-user notification channels (Discord webhook, SMS).
-- Telegram/email already covered elsewhere; this is the extension.
CREATE TABLE IF NOT EXISTS public.user_notification_channels (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_webhook  text,
  sms_phone        text,           -- E.164 format (+15551234567)
  sms_enabled      boolean NOT NULL DEFAULT false,
  discord_enabled  boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "user_notification_channels_own"
  ON public.user_notification_channels FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- P2-F.8 alert_templates — curated pre-built alert recipes the UI can
-- instantiate with one click ("Smart-money X bought a microcap" etc).
CREATE TABLE IF NOT EXISTS public.alert_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  description   text NOT NULL,
  category      text NOT NULL CHECK (category IN ('smart_money', 'whale', 'price', 'social', 'security')),
  expression    jsonb NOT NULL,
  default_cooldown_seconds int NOT NULL DEFAULT 300,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "alert_templates_public_read"
  ON public.alert_templates FOR SELECT USING (true);

-- Seed a small starter library of templates — these are NOT mock data,
-- they're the curated default recipes users see in the picker.
INSERT INTO public.alert_templates (slug, title, description, category, expression) VALUES
  ('smart_money_microcap_buy',
   'Smart-money bought a microcap',
   'Notify when any wallet in the smart-money cohort buys >$10K of a sub-$5M-cap token.',
   'smart_money',
   '{"op":"AND","children":[{"type":"whale_buy","cohort":"smart_money","min_usd":10000},{"type":"market_cap_below","threshold_usd":5000000}]}'::jsonb),
  ('whale_dump_100k',
   'Whale dumped >$100K',
   'Notify when any tracked whale sells >$100K of a single token in one tx.',
   'whale',
   '{"op":"AND","children":[{"type":"whale_action","action":"sell","min_usd":100000}]}'::jsonb),
  ('btc_breakout',
   'BTC breaks resistance',
   'Notify when BTC closes above $100K on the 1h chart.',
   'price',
   '{"op":"AND","children":[{"type":"price","symbol":"BTC","direction":"above","threshold":100000}]}'::jsonb),
  ('twitter_velocity_spike',
   'Twitter velocity spike',
   'Notify when a token''s 6h tweet rate exceeds 400% of its 24h baseline.',
   'social',
   '{"op":"AND","children":[{"type":"velocity","platform":"twitter","threshold_pct":400}]}'::jsonb),
  ('rug_band_downgrade',
   'Deployer reputation downgrade',
   'Notify when a deployer of a token you hold drops to dangerous or serial-rugger band.',
   'security',
   '{"op":"AND","children":[{"type":"deployer_band","band":"dangerous"}]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
