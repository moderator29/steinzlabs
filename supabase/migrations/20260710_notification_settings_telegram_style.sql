-- Telegram message style — "normal" vs "advanced".
--
-- Every outbound bot message is rendered by the shared template system
-- (lib/telegram/templates.ts). This per-user preference selects between a
-- compact card ('normal', the default) and a richer one with more fields and
-- more inline buttons ('advanced'). Read wherever messages are composed:
--   - lib/telegram/notify.ts        (generic platform pushes)
--   - app/api/cron/news-telegram    (news drop)
--   - lib/telegram/broadcast.ts     (announcements)
--
-- Default 'normal' so existing users are unaffected until they opt into
-- advanced. CHECK keeps the column to the two known values.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS telegram_style text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_settings_telegram_style_check'
  ) THEN
    ALTER TABLE public.notification_settings
      ADD CONSTRAINT notification_settings_telegram_style_check
      CHECK (telegram_style IN ('normal', 'advanced'));
  END IF;
END $$;
