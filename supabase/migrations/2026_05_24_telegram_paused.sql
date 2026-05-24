-- TG4: platform-level kill switch for the Telegram bot. When true,
-- /api/telegram/webhook short-circuits with 503 and outbound senders
-- (sendTelegramMessage callers) treat it as 'not configured' so we
-- don't push a backlog into the retry queue during deliberate outage.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS telegram_paused boolean NOT NULL DEFAULT false;
