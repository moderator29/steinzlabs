-- NW3 — Passkey unlock prototype.
-- Schema + RLS for WebAuthn credential storage. The server/client wiring
-- (@simplewebauthn/server, @simplewebauthn/browser, UnlockWalletModal
-- "Use passkey" button) lands in a follow-up branch; shipping the
-- migration first so it can be applied + verified independently of the
-- JS rollout.

CREATE TABLE IF NOT EXISTS public.user_passkeys (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id  text NOT NULL,
  public_key     bytea NOT NULL,
  sign_count     bigint NOT NULL DEFAULT 0,
  transports     text[],
  device_name    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  PRIMARY KEY (user_id, credential_id)
);

CREATE INDEX IF NOT EXISTS user_passkeys_credential_id_idx
  ON public.user_passkeys (credential_id);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_passkeys_own ON public.user_passkeys;
CREATE POLICY user_passkeys_own ON public.user_passkeys
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Feature flag — default OFF so the unlock modal does not surface the
-- "Use passkey" button until the JS implementation lands and is QA'd.
INSERT INTO public.feature_flags (key, enabled, description, rollout_pct)
VALUES ('passkey_unlock', false, 'WebAuthn-backed wallet unlock (NW3)', 0)
ON CONFLICT (key) DO NOTHING;
