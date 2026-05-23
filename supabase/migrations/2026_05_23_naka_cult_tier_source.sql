-- Track WHERE a user's tier came from so the daily NAKA-balance resolver
-- doesn't accidentally downgrade users who paid via Stripe.
--
-- Companion to app/api/cron/naka-cult-resolver/route.ts.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_source TEXT,
  ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.tier_source IS
  'How this tier was granted: naka_balance (on-chain $NAKA holdings), stripe (paid sub), admin (manual override), or NULL.';

COMMENT ON COLUMN public.profiles.tier_updated_at IS
  'Last time tier or tier_source changed. Set by the naka-cult-resolver cron and Stripe webhook.';

-- Backfill existing rows: assume current tier came from stripe/admin so
-- the first cron run only ADDS naka_balance tier_source, never revokes.
UPDATE public.profiles
SET tier_source = CASE
      WHEN tier IS NULL OR tier = 'free' THEN NULL
      ELSE 'legacy'
    END,
    tier_updated_at = COALESCE(updated_at, NOW())
WHERE tier_source IS NULL;

COMMIT;
