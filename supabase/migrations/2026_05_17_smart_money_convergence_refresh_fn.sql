CREATE OR REPLACE FUNCTION public.refresh_smart_money_convergence(p_window_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rows_written integer;
BEGIN
  UPDATE public.smart_money_convergence
     SET is_active = false
   WHERE is_active = true
     AND detected_at < now() - make_interval(hours => p_window_hours);

  WITH agg AS (
    SELECT
      wa.token_address,
      wa.chain,
      (array_agg(wa.token_symbol) FILTER (WHERE wa.token_symbol IS NOT NULL))[1] AS token_symbol,
      COUNT(DISTINCT wa.whale_address)::int AS wallet_count,
      array_agg(DISTINCT wa.whale_address) AS wallets,
      COALESCE(SUM(wa.value_usd), 0)::numeric AS total_value_usd
    FROM public.whale_activity wa
    WHERE wa.action IN ('buy', 'swap')
      AND wa.token_address IS NOT NULL
      AND wa.timestamp > now() - make_interval(hours => p_window_hours)
    GROUP BY wa.token_address, wa.chain
    HAVING COUNT(DISTINCT wa.whale_address) >= 2
  )
  INSERT INTO public.smart_money_convergence (token_address, token_symbol, chain, wallet_count, wallets, total_value_usd, detected_at, is_active)
  SELECT a.token_address, a.token_symbol, a.chain, a.wallet_count, a.wallets, a.total_value_usd, now(), true
    FROM agg a
    ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS rows_written = ROW_COUNT;
  RETURN rows_written;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_smart_money_convergence(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_smart_money_convergence(integer) TO service_role;
