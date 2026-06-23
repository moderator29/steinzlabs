-- 2026-06-22 — add metadata jsonb to notifications.
-- The notifications writers (lib/social/notify.ts, lib/notifications/channels.ts,
-- app/api/notifications) and the bell's event_id idempotency check all expect a
-- metadata jsonb column that was never added to the live table. Add it (nullable,
-- additive). Text content standardizes on the existing NOT NULL `body` column.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb;
