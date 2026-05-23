-- ALERT1: enable Supabase Realtime on notifications so the bell + UI
-- channels can subscribe to live INSERTs instead of polling every 2min.
-- The publication is named supabase_realtime by default; guard with DO
-- so the migration is idempotent and survives a rerun.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END$$;

-- ALERT4 + ALERT7: durable retry queues for outbound notification
-- channels. fanOutNotification writes a row when an external channel
-- send fails; the notification-retry cron picks them up with
-- exponential backoff (1h → 24h → 7d → drop).
CREATE TABLE IF NOT EXISTS public.pending_telegram_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id         bigint NOT NULL,
  body            text NOT NULL,
  attempts        int NOT NULL DEFAULT 0,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz
);
CREATE INDEX IF NOT EXISTS pending_telegram_due_idx
  ON public.pending_telegram_messages (next_retry_at)
  WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pending_discord_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_url     text NOT NULL,
  payload         jsonb NOT NULL,
  attempts        int NOT NULL DEFAULT 0,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz
);
CREATE INDEX IF NOT EXISTS pending_discord_due_idx
  ON public.pending_discord_messages (next_retry_at)
  WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pending_sms_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone           text NOT NULL,
  body            text NOT NULL,
  attempts        int NOT NULL DEFAULT 0,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz
);
CREATE INDEX IF NOT EXISTS pending_sms_due_idx
  ON public.pending_sms_messages (next_retry_at)
  WHERE delivered_at IS NULL;

-- These retry queues are written by server code only; users never
-- read them directly. Service role bypasses RLS for the writer; we
-- still enable RLS + deny-all by default so an accidental anon-key
-- read returns nothing.
ALTER TABLE public.pending_telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_discord_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_sms_messages      ENABLE ROW LEVEL SECURITY;
