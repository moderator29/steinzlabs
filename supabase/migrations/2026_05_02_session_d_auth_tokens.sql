-- Session D — Server-stored opaque auth tokens (reset, verify).
-- Replaces the deterministic HMAC scheme in lib/authTokens.ts. See the file
-- header for the security rationale.
-- Applied to live DB via Supabase MCP (migration: session_d_auth_tokens).

CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('reset', 'verify')),
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  ip_address    text
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_kind  ON public.auth_tokens(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON public.auth_tokens(expires_at) WHERE consumed_at IS NULL;

ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_auth_tokens ON public.auth_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.prune_auth_tokens()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.auth_tokens WHERE created_at < now() - interval '7 days';
$$;

REVOKE EXECUTE ON FUNCTION public.prune_auth_tokens() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_auth_tokens() TO service_role;
