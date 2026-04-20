-- Per-user log of broadcast attempts from the Naka Wallet.
-- Server writes one row per send; users can read their own via RLS.

CREATE TABLE IF NOT EXISTS public.wallet_send_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain      TEXT NOT NULL,
  to_address TEXT,
  amount     TEXT,
  symbol     TEXT,
  tx_hash    TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_send_log_user ON public.wallet_send_log (user_id, created_at DESC);

ALTER TABLE public.wallet_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_send_log_own" ON public.wallet_send_log;
CREATE POLICY "wallet_send_log_own" ON public.wallet_send_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "wallet_send_log_service" ON public.wallet_send_log;
CREATE POLICY "wallet_send_log_service" ON public.wallet_send_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
