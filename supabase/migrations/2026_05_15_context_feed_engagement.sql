-- Context-feed engagement persistence.
--
-- Distinct from public.engagement (which is for research_posts and
-- FK-locks to that table). Context-feed events are ephemeral, cross-
-- source aggregations (whale transfers, pump.fun launches, DEX listings,
-- CoinGecko gainers, etc.) so the event_id is a TEXT identifier with
-- no FK target.
--
-- Replaces the in-memory Map in /api/engagement/route.ts which lost
-- every count on serverless redeploy.

CREATE TABLE IF NOT EXISTS public.context_feed_engagement (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    TEXT        NOT NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL CHECK (action IN ('view', 'like', 'share', 'comment')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aggregation lookups go through event_id; counters page reads all
-- rows for one event and groups by action.
CREATE INDEX IF NOT EXISTS idx_cfe_event ON public.context_feed_engagement (event_id);

-- Per-user-per-event-per-action uniqueness lets us treat insert as an
-- idempotent upsert for view + like (a user shouldn't be able to
-- inflate counts by re-clicking). Anonymous (user_id NULL) rows are
-- allowed to repeat — anon "views" are essentially impressions and
-- we'd rather double-count anon than under-count signed-in users.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfe_unique_user_action
  ON public.context_feed_engagement (event_id, user_id, action)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.context_feed_engagement ENABLE ROW LEVEL SECURITY;

-- INSERT: signed-in users may only insert rows owned by themselves;
-- anon may insert rows with user_id NULL (impression / view tracking).
DROP POLICY IF EXISTS context_feed_engagement_insert ON public.context_feed_engagement;
CREATE POLICY context_feed_engagement_insert
  ON public.context_feed_engagement FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- DELETE: only the owning user may remove their like (used by unlike).
DROP POLICY IF EXISTS context_feed_engagement_delete_own ON public.context_feed_engagement;
CREATE POLICY context_feed_engagement_delete_own
  ON public.context_feed_engagement FOR DELETE
  USING (auth.uid() = user_id);

-- SELECT: counts are public per event (the UI shows "12 likes" to
-- everyone). Restricting reads would force every page load through a
-- service-role aggregator endpoint, which is heavier for no privacy
-- gain since the counts are intentionally public.
DROP POLICY IF EXISTS context_feed_engagement_select_all ON public.context_feed_engagement;
CREATE POLICY context_feed_engagement_select_all
  ON public.context_feed_engagement FOR SELECT
  USING (true);

COMMENT ON TABLE public.context_feed_engagement IS
  'Persistent engagement counters for context-feed events. Distinct from public.engagement (research_posts) — context-feed events have no canonical row to FK against, so event_id is a free-form TEXT identifier.';
