-- Phase 1 of 24/7 non-custodial auto-copy (see docs/design/2026-06-28-session-key-auto-copy.md).
-- Inert: adds storage only — no code signs with these yet.

-- Ciphertext of the session EOA private key (AES-256-GCM, server secret NOT in DB).
-- NULL keeps the legacy client-signing rows working unchanged.
ALTER TABLE public.user_session_keys
  ADD COLUMN IF NOT EXISTS encrypted_session_key text,
  ADD COLUMN IF NOT EXISTS key_version int NOT NULL DEFAULT 1;

-- Append-only spend ledger — the single source of truth for the daily cap, and
-- the idempotency guard so the same whale tx can never be auto-copied twice.
CREATE TABLE IF NOT EXISTS public.session_key_spends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key_id uuid NOT NULL REFERENCES public.user_session_keys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_usd numeric NOT NULL,
  source_tx_hash text NOT NULL,
  broadcast_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_key_id, source_tx_hash)
);

CREATE INDEX IF NOT EXISTS session_key_spends_daily_idx
  ON public.session_key_spends (session_key_id, created_at DESC);

-- RLS: a user may read their own spend rows; only the service role writes
-- (the signer runs server-side). No client INSERT/UPDATE/DELETE.
ALTER TABLE public.session_key_spends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_key_spends_owner_read ON public.session_key_spends;
CREATE POLICY session_key_spends_owner_read ON public.session_key_spends
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
