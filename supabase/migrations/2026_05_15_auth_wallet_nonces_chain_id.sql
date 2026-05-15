-- EIP-4361 SIWE rollout — extend auth_wallet_nonces with the values
-- the new buildSiweMessage() helper needs to reconstruct the exact
-- bytes the user signed at issuance. Additive: legacy rows keep
-- working (wallet-verify falls back to the old free-form message
-- when issued_at is NULL).
--
-- Owner: apply via Supabase SQL editor or `mcp__supabase__apply_migration`.
-- The verify route degrades gracefully until this lands.

ALTER TABLE public.auth_wallet_nonces
  ADD COLUMN IF NOT EXISTS chain_id integer,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

COMMENT ON COLUMN public.auth_wallet_nonces.chain_id IS
  'EIP-4361 Chain ID (EVM only). NULL for Solana — chain shape is recorded as `solana` in the message text.';
COMMENT ON COLUMN public.auth_wallet_nonces.issued_at IS
  'Wall-clock instant at issuance. Verify-side reconstruction includes this in the SIWE Issued At line so the signed bytes match exactly.';
