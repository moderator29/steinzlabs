-- First-run gate for the gold MAX welcome banners. The 3-step Max welcome is
-- shown once, only the first time a user reaches the Max plan. Backfill every
-- CURRENT Max holder to now() so existing/returning users (who signed up
-- before this shipped) never get a surprise welcome — only genuinely new
-- first-time Max unlocks going forward will see it (column stays NULL until
-- they unlock, then is stamped when they finish/skip the welcome).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_welcomed_at timestamptz;

UPDATE public.profiles
  SET max_welcomed_at = now()
  WHERE max_welcomed_at IS NULL
    AND lower(coalesce(tier, 'free')) = 'max';
