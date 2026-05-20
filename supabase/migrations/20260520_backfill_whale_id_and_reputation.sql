-- §S1-DATA — user_whale_follows.whale_id was NULL for every row even when
-- an equivalent whale exists in public.whales (linkable via address+chain).
-- Backfill from the natural join so the reputation scorer (which joins on
-- whale_id) can compute whale_pick_accuracy.
--
-- Then seed user_reputation with the components we CAN compute from real
-- data (whale_pick_accuracy and community_score). copy_trade_winrate /
-- portfolio_perf_pct / activity_score remain NULL until the source tables
-- (user_copy_trades, swap_logs, feature_usage) start receiving events.
--
-- Applied to live DB via Supabase MCP on 2026-05-20.

UPDATE public.user_whale_follows f
SET whale_id = w.id
FROM public.whales w
WHERE f.whale_id IS NULL
  AND LOWER(w.address) = LOWER(f.whale_address)
  AND w.chain = f.chain;

WITH whale_acc AS (
  SELECT
    f.user_id,
    CASE WHEN COUNT(w.id) FILTER (WHERE w.pnl_30d_usd IS NOT NULL) = 0
         THEN NULL
         ELSE ROUND(
                (COUNT(w.id) FILTER (WHERE w.pnl_30d_usd > 0))::numeric
                / NULLIF(COUNT(w.id) FILTER (WHERE w.pnl_30d_usd IS NOT NULL), 0)
                * 100
              )::int
    END AS pct
  FROM public.user_whale_follows f
  LEFT JOIN public.whales w ON w.id = f.whale_id
  GROUP BY f.user_id
),
followers AS (
  SELECT following_id AS user_id, COUNT(*)::int AS n
  FROM public.social_follows
  WHERE status = 'accepted'
  GROUP BY following_id
),
community AS (
  SELECT user_id, LEAST(100, ROUND(75 * (1 - EXP(-n::numeric / 60.0)))::int) AS pct
  FROM followers
)
INSERT INTO public.user_reputation (
  user_id, success_rate,
  whale_pick_accuracy, community_score, last_calculated_at
)
SELECT
  p.id,
  GREATEST(0, LEAST(100, ROUND(
    (
      COALESCE(w.pct, 0) * CASE WHEN w.pct IS NOT NULL THEN 0.25 ELSE 0 END
    + COALESCE(c.pct, 0) * CASE WHEN c.pct IS NOT NULL THEN 0.10 ELSE 0 END
    ) / NULLIF(
      (CASE WHEN w.pct IS NOT NULL THEN 0.25 ELSE 0 END
     + CASE WHEN c.pct IS NOT NULL THEN 0.10 ELSE 0 END), 0)
  ))::int),
  w.pct,
  COALESCE(c.pct, 0),
  now()
FROM public.profiles p
LEFT JOIN whale_acc w ON w.user_id = p.id
LEFT JOIN community  c ON c.user_id = p.id
WHERE w.pct IS NOT NULL OR c.pct IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET whale_pick_accuracy = EXCLUDED.whale_pick_accuracy,
      community_score     = EXCLUDED.community_score,
      success_rate        = EXCLUDED.success_rate,
      last_calculated_at  = EXCLUDED.last_calculated_at;

WITH ranked AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY success_rate DESC NULLS LAST) AS rk
  FROM public.user_reputation
  WHERE success_rate IS NOT NULL
)
UPDATE public.user_reputation r
SET rank_overall = ranked.rk
FROM ranked
WHERE r.user_id = ranked.user_id;
