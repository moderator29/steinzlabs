-- Copy Trading: per-rule trade filters (direction, min whale-trade size, token
-- allow-list) to finish the rule surface described in the product spec. The
-- block-list (tokens_blacklist) and slippage/caps already exist; this adds the
-- three filters that were exposed nowhere and enforced nowhere.
--
-- Idempotent + additive: only adds nullable columns with safe defaults, so it is
-- safe to re-run and cannot reject any existing write. Apply BEFORE (or together
-- with) the code that reads these columns — the matcher/execute paths default
-- every value, so a rule with these left NULL behaves exactly as it does today.

ALTER TABLE public.user_copy_rules
  -- 'both' (default), 'buy' (mirror the whale's buys only), or 'sell' (exits only).
  ADD COLUMN IF NOT EXISTS copy_direction text NOT NULL DEFAULT 'both',
  -- Ignore whale trades smaller than this USD notional. NULL = copy any size.
  ADD COLUMN IF NOT EXISTS min_trade_size_usd numeric,
  -- If non-empty, ONLY these token addresses may be copied (allow-list). NULL /
  -- empty = allow everything except tokens_blacklist.
  ADD COLUMN IF NOT EXISTS tokens_allowlist text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'user_copy_rules_copy_direction_check'
  ) THEN
    ALTER TABLE public.user_copy_rules
      ADD CONSTRAINT user_copy_rules_copy_direction_check
      CHECK (copy_direction IN ('both','buy','sell'));
  END IF;
END$$;
