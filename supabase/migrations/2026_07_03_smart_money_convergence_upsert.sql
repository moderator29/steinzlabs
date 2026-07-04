-- Convergence pipeline fix: rows accumulated stale duplicates (ON CONFLICT DO
-- NOTHING with no unique constraint conflicted only on the fresh uuid PK, so
-- every refresh inserted a new row per token). Added last_refreshed_at, deduped
-- to one row per (token_address, chain) preserving earliest detected_at as
-- first-seen, added the unique index, and rewrote refresh_smart_money_convergence
-- as a proper upsert that refreshes counts and deactivates tokens no longer
-- converging. See app/api/whale-tracker/convergence (Convergence Radar).
ALTER TABLE public.smart_money_convergence
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS smart_money_convergence_token_chain_uidx
  ON public.smart_money_convergence (token_address, chain);
-- (dedupe + function body applied via Supabase MCP; see migration
--  smart_money_convergence_upsert_2026_07_03 in the migration history)
