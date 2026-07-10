-- Multi-image feed posts: up to 4 images per wire. Keep the legacy single
-- media_url column for back-compat; new posts populate media_urls[] and the
-- card renders a gallery. Existing rows keep working (media_url still read).
ALTER TABLE public.wire_posts
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.wire_posts
   SET media_urls = ARRAY[media_url]
 WHERE media_url IS NOT NULL
   AND (media_urls IS NULL OR array_length(media_urls, 1) IS NULL);

-- Explicit, dedicated opt-in for the crypto NEWS digest email, separate from
-- the account's global email preference. The news-digest cron gates email on
-- THIS flag so tapping the News "Alerts" bell never surprises a Telegram-only
-- user with email. Off by default.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS news_email_enabled boolean NOT NULL DEFAULT false;
