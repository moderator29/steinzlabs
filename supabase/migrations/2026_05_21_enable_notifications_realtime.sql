-- Enable Supabase Realtime on the notifications table so NotificationBell can
-- subscribe to INSERT + UPDATE events filtered by user_id. The bell still
-- polls every 5 min as a belt-and-braces refresh, but Realtime is what
-- delivers a new whale alert / price-target / copy-trade notice to the
-- navbar bell in <2s (acceptance criterion in §3 P1-B).
--
-- Idempotent: only adds the table to the publication if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname    = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename  = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Row-level security on `notifications` must already restrict SELECT to the
-- owning user; Realtime honors RLS for postgres_changes so the channel will
-- not leak other users' rows even with a broad filter.
