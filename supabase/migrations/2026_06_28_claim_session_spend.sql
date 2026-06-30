-- Atomic daily-cap claim for session-key auto-copy (mirrors claim_copy_trade).
-- Without this, two concurrent copy events for DIFFERENT whale txs both read
-- spent=0, both pass the app-level cap check, and both execute → the daily cap
-- is breached. Take a per-session advisory lock, recompute the trailing-24h
-- spend under the lock, and insert-or-reject atomically. The UNIQUE
-- (session_key_id, source_tx_hash) also makes the same whale tx idempotent.
CREATE OR REPLACE FUNCTION public.claim_session_spend(
  p_session_key_id uuid,
  p_user uuid,
  p_amount numeric,
  p_daily_cap numeric,
  p_source_tx text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spent numeric;
  v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN NULL;
  END IF;

  -- Serialize all claims for this session key.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_key_id::text, 0));

  -- Trailing-24h spend under the lock.
  SELECT COALESCE(sum(amount_usd), 0) INTO v_spent
  FROM session_key_spends
  WHERE session_key_id = p_session_key_id
    AND created_at >= now() - interval '24 hours';

  IF p_daily_cap IS NOT NULL AND v_spent + p_amount > p_daily_cap THEN
    RETURN NULL; -- would breach the daily cap
  END IF;

  INSERT INTO session_key_spends (session_key_id, user_id, amount_usd, source_tx_hash)
  VALUES (p_session_key_id, p_user, p_amount, p_source_tx)
  ON CONFLICT (session_key_id, source_tx_hash) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id; -- NULL when this source_tx was already claimed
END;
$$;

-- Server-side only: revoke from anon/authenticated, grant to service_role.
REVOKE ALL ON FUNCTION public.claim_session_spend(uuid, uuid, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_session_spend(uuid, uuid, numeric, numeric, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_session_spend(uuid, uuid, numeric, numeric, text) TO service_role;
