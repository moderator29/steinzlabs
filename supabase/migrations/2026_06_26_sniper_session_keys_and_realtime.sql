-- Applies the never-applied trading-signing schema (session keys) and enables
-- realtime for sniper fills + price-alert triggers. The original
-- 2026_05_21_trading_signing_ux.sql used invalid `CREATE POLICY IF NOT EXISTS`
-- and never applied to the live DB; this re-versions it with guarded DO blocks
-- and adds the realtime publication wiring the sniper terminal depends on.

CREATE TABLE IF NOT EXISTS public.user_session_keys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_address   text NOT NULL,
  main_address      text NOT NULL,
  chain             text NOT NULL,
  max_per_trade_usd numeric NOT NULL,
  daily_cap_usd     numeric NOT NULL,
  allowed_tokens    text[],
  auth_signature    text NOT NULL,
  auth_payload      jsonb NOT NULL,
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_session_keys_user_active_idx
  ON public.user_session_keys (user_id, expires_at) WHERE revoked_at IS NULL;

ALTER TABLE public.user_session_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_session_keys' AND policyname='user_session_keys_own_read') THEN
    CREATE POLICY "user_session_keys_own_read" ON public.user_session_keys FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_session_keys' AND policyname='user_session_keys_own_revoke') THEN
    CREATE POLICY "user_session_keys_own_revoke" ON public.user_session_keys FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tx_replacements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain           text NOT NULL,
  original_tx     text NOT NULL,
  replacement_tx  text NOT NULL,
  nonce           bigint NOT NULL,
  action          text NOT NULL CHECK (action IN ('cancel','replace','speedup')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','mined','failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_replacements_user_idx ON public.tx_replacements (user_id, created_at DESC);
ALTER TABLE public.tx_replacements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tx_replacements' AND policyname='tx_replacements_own') THEN
    CREATE POLICY "tx_replacements_own" ON public.tx_replacements FOR ALL TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sniper_executions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sniper_executions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='price_alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.price_alerts;
  END IF;
END $$;
