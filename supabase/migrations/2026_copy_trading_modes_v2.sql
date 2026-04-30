-- §3 Copy Trading: three-mode support (alerts_only / oneclick / auto_copy),
-- percent-of-whale sizing, TP/SL, cooldown, pause.
-- Idempotent: safe to re-run.

ALTER TABLE public.user_copy_rules
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS pct_of_whale numeric,
  ADD COLUMN IF NOT EXISTS tp_pct numeric,
  ADD COLUMN IF NOT EXISTS sl_pct numeric,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wallet_address text;

-- Backfill mode for legacy rows: existing rules went through the 'oneclick'
-- path. Rows where require_confirmation=false get 'auto_copy'; others
-- 'oneclick'.
UPDATE public.user_copy_rules
SET mode = CASE
  WHEN require_confirmation = false THEN 'auto_copy'
  ELSE 'oneclick'
END
WHERE mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'user_copy_rules_mode_check'
  ) THEN
    ALTER TABLE public.user_copy_rules
      ADD CONSTRAINT user_copy_rules_mode_check
      CHECK (mode IN ('alerts_only','oneclick','auto_copy'));
  END IF;
END$$;

-- Hot-path index: matcher fans out by (chain, whale_address) for each event.
CREATE INDEX IF NOT EXISTS idx_user_copy_rules_whale
  ON public.user_copy_rules (chain, lower(whale_address))
  WHERE enabled = true AND paused = false;
