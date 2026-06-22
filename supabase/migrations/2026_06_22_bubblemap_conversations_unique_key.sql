-- 2026-06-22 — add the unique key the bubblemap-agent upsert relies on.
-- The upsert targets onConflict (user_id, token_address, chain) but no matching
-- unique constraint existed, so every persist errored (42P10) and was swallowed —
-- conversations were never saved. (Table was empty, so no dedup needed.)
ALTER TABLE public.bubblemap_conversations
  ADD CONSTRAINT bubblemap_conversations_user_token_chain_key
  UNIQUE (user_id, token_address, chain);
