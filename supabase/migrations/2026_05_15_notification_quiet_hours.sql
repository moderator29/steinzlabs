-- Phase B (profile features) — extend notification_settings with
-- quiet hours + per-channel toggles. Existing columns unchanged so
-- existing rows keep working.
--
-- Owner: apply via `supabase db push` or the SQL editor when ready.
-- The Phase B Notification Settings panel detects column absence at
-- runtime and gracefully hides the quiet-hours UI until this lands.

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start_minute integer NOT NULL DEFAULT 1320,
  ADD COLUMN IF NOT EXISTS quiet_hours_end_minute integer NOT NULL DEFAULT 420,
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone text NOT NULL DEFAULT 'UTC';

COMMENT ON COLUMN public.notification_settings.quiet_hours_start_minute IS
  'Minutes from 00:00 in the user timezone where Do Not Disturb begins (0-1439).';
COMMENT ON COLUMN public.notification_settings.quiet_hours_end_minute IS
  'Minutes from 00:00 in the user timezone where Do Not Disturb ends (0-1439).';
COMMENT ON COLUMN public.notification_settings.quiet_hours_timezone IS
  'IANA timezone (e.g. America/New_York). Defaults to UTC.';
