-- 2026-06-22 — point populate_whale_score at the table that's actually read.
-- It updated wallet_profiles.whale_score, but every read uses whales.whale_score,
-- so cron-computed scores never reached any surface. Same scoring formula; now
-- targets public.whales (meaningful once value_usd is populated).
CREATE OR REPLACE FUNCTION public.populate_whale_score(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rows_updated integer := 0;
BEGIN
  WITH agg AS (
    SELECT
      wa.whale_address AS address,
      wa.chain,
      COALESCE(SUM(wa.value_usd), 0)::numeric AS total_volume_usd,
      COUNT(*)::int AS trade_count,
      COUNT(DISTINCT wa.token_address)::int AS distinct_tokens,
      EXTRACT(EPOCH FROM (now() - MAX(wa.timestamp)))::numeric / 86400.0 AS days_since_last
    FROM public.whale_activity wa
    WHERE wa.timestamp > now() - make_interval(days => p_days)
      AND wa.whale_address IS NOT NULL
    GROUP BY wa.whale_address, wa.chain
  ),
  scored AS (
    SELECT
      address,
      chain,
      LEAST(100, GREATEST(0,
        ROUND(
          (LEAST(40, LOG(GREATEST(total_volume_usd, 1)) * 5)) +
          (LEAST(20, trade_count * 0.5)) +
          (LEAST(20, distinct_tokens * 1.5)) +
          (GREATEST(0, 20 - LEAST(20, days_since_last)))
        )
      ))::int AS whale_score
    FROM agg
  )
  UPDATE public.whales w
     SET whale_score = s.whale_score,
         updated_at = now()
    FROM scored s
   WHERE w.address = s.address
     AND w.chain = s.chain
     AND (w.whale_score IS DISTINCT FROM s.whale_score);

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.populate_whale_score(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.populate_whale_score(integer) TO service_role;
