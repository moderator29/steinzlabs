-- Per-user security-center feed table (had no schema and no producer).
CREATE TABLE IF NOT EXISTS public.user_token_security_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address text NOT NULL,
  chain         text NOT NULL,
  is_honeypot   boolean NOT NULL DEFAULT false,
  risk_level    text,
  risk_score    integer,
  risk_reasons  text[],
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token_address, chain)
);
ALTER TABLE public.user_token_security_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_token_security_flags_own ON public.user_token_security_flags;
CREATE POLICY user_token_security_flags_own ON public.user_token_security_flags
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS user_token_security_flags_user_idx
  ON public.user_token_security_flags (user_id);
