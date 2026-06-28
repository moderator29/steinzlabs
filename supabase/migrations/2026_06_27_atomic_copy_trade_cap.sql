-- #13 Atomic daily-cap for copy trades. Three independent paths (cron monitor,
-- webhook matcher, manual execute) each read sum(amount_usd) then enforce the
-- cap in application code with no DB lock, so concurrent fan-outs can each pass
-- the check and collectively overspend a user's daily_cap_usd.
--
-- This function serializes per user via a transaction-scoped advisory lock,
-- re-checks the rolling 24h spend, and only inserts the pending row if the buy
-- stays within cap — returning the new id, or NULL when the cap would be
-- exceeded. Sells (amount_usd NULL) are never capped. Callers run it under
-- service_role; anon/authenticated cannot execute it.
CREATE OR REPLACE FUNCTION public.claim_copy_trade(
  p_user uuid,
  p_daily_cap numeric,
  p_amount numeric,
  p_source_whale text,
  p_source_tx text,
  p_chain text,
  p_token_address text,
  p_token_symbol text,
  p_action text,
  p_security_score integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spent numeric;
  v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  IF p_action = 'buy' AND p_daily_cap IS NOT NULL THEN
    SELECT COALESCE(sum(amount_usd), 0) INTO v_spent
      FROM user_copy_trades
      WHERE user_id = p_user
        AND status IN ('pending','success')
        AND created_at > now() - interval '24 hours';
    IF (v_spent + COALESCE(p_amount, 0)) > p_daily_cap THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO user_copy_trades(
    user_id, source_whale, source_tx_hash, chain, token_address, token_symbol,
    action, amount_usd, status, security_score
  ) VALUES (
    p_user, p_source_whale, p_source_tx, p_chain, p_token_address, p_token_symbol,
    p_action, CASE WHEN p_action = 'buy' THEN p_amount ELSE NULL END, 'pending', p_security_score
  ) RETURNING id INTO v_id;

  RETURN v_id;
END$$;

REVOKE EXECUTE ON FUNCTION public.claim_copy_trade(uuid,numeric,numeric,text,text,text,text,text,text,integer) FROM anon, authenticated;
