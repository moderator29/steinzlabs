-- #36: single-slot last_token re-pinged on token churn and missed concurrent
-- matches. Add a small recent-tokens ring so a user isn't re-alerted for a
-- token they were recently notified about, while still catching genuinely new
-- ones. Seeded from the existing last_token for continuity.
ALTER TABLE public.feed_alerts ADD COLUMN IF NOT EXISTS recent_tokens text[] NOT NULL DEFAULT '{}';
UPDATE public.feed_alerts
  SET recent_tokens = ARRAY[last_token]
  WHERE last_token IS NOT NULL AND last_token <> '' AND recent_tokens = '{}';
