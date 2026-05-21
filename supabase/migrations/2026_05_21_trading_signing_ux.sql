-- §3 P2-D trading/signing UX schema.

-- P2-D.1 session keys for auto_copy mode. Ephemeral keypair the user
-- generates client-side, signs once with the main wallet to authorize
-- a tight scope (max_per_trade_usd, daily_cap_usd, expiry, allowed
-- chains), and the relayer broadcasts using that session key for the
-- N hours the auth holds. The private key NEVER hits our DB — only
-- the public address + the auth params + the user's signature do.

CREATE TABLE IF NOT EXISTS public.user_session_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Public address of the ephemeral session keypair (the user signs a
  -- statement authorizing this exact address; the relayer accepts txs
  -- it signs as if they were the main wallet's, scoped to the params).
  session_address text NOT NULL,
  main_address    text NOT NULL,             -- main wallet that authorized this
  chain           text NOT NULL,
  max_per_trade_usd numeric NOT NULL,
  daily_cap_usd     numeric NOT NULL,
  allowed_tokens  text[],                    -- nullable = any token (whale-driven)
  -- EIP-712 signature from the main wallet authorizing the session
  auth_signature  text NOT NULL,
  auth_payload    jsonb NOT NULL,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_session_keys_user_active_idx
  ON public.user_session_keys (user_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.user_session_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "user_session_keys_own_read"
  ON public.user_session_keys FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "user_session_keys_own_revoke"
  ON public.user_session_keys FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- P2-D.3 cancel/replace tx attempts log. Records when the user
-- replaces a stuck tx so we can show "replaced by 0xnew" in the UI.
CREATE TABLE IF NOT EXISTS public.tx_replacements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain           text NOT NULL,
  original_tx     text NOT NULL,
  replacement_tx  text NOT NULL,
  nonce           bigint NOT NULL,
  action          text NOT NULL CHECK (action IN ('cancel', 'replace', 'speedup')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mined', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tx_replacements_user_idx ON public.tx_replacements (user_id, created_at DESC);
ALTER TABLE public.tx_replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tx_replacements_own"
  ON public.tx_replacements FOR ALL TO authenticated
  USING (user_id = auth.uid());
