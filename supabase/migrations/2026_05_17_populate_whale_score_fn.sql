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
      )) AS whale_score
    FROM agg
  )
  UPDATE public.wallet_profiles wp
     SET whale_score = s.whale_score
    FROM scored s
   WHERE wp.address = s.address
     AND wp.chain = s.chain
     AND (wp.whale_score IS DISTINCT FROM s.whale_score);

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.populate_whale_score(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.populate_whale_score(integer) TO service_role;
