-- Telegram "news drop" opt-in (app/api/cron/news-telegram).
--
-- A DEDICATED, off-by-default opt-in for the clean news-to-Telegram broadcast.
-- Kept separate from news_alerts (the twice-daily news-digest) on purpose so the
-- two channels never double-send: a user only receives the news drop after
-- explicitly enabling telegram_news_drop.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS telegram_news_drop boolean NOT NULL DEFAULT false;

-- Idempotency marker: a signature of the exact headline set last delivered to
-- this user via the news drop. The cron skips a user whose stored signature
-- matches the current edition, so the same set never lands twice — while a
-- refreshed edition (headlines rotated) still goes out once.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS telegram_news_last_sig text;
