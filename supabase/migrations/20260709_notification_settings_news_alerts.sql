-- News digest opt-in. When true and the user has a delivery channel enabled
-- (telegram_enabled / email_enabled), the news-digest cron sends them a
-- twice-daily roundup of top crypto headlines. Off by default (no surprise mail).
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS news_alerts boolean NOT NULL DEFAULT false;

-- Tracks the last headline URL we sent per user so the digest never repeats the
-- same lead story and only fires when there's genuinely something new.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS news_alerts_last_url text;
