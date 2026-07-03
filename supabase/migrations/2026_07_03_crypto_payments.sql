-- Crypto-native tier payments (no Stripe). See app/api/payments/* + the
-- payment-verify cron. Unique expected_amount lets us match an incoming USDC
-- transfer to a pending payment without memos.
CREATE TABLE IF NOT EXISTS public.crypto_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier            text NOT NULL CHECK (tier IN ('mini','pro','max')),
  chain           text NOT NULL,
  token           text NOT NULL DEFAULT 'USDC',
  pay_to_address  text NOT NULL,
  expected_amount numeric NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','expired')),
  tx_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  confirmed_at    timestamptz
);
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crypto_payments_select_own ON public.crypto_payments;
CREATE POLICY crypto_payments_select_own ON public.crypto_payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS crypto_payments_pending_idx
  ON public.crypto_payments (chain, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS crypto_payments_user_idx
  ON public.crypto_payments (user_id, created_at DESC);

-- tier_source gains 'crypto'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_source_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tier_source_check
  CHECK (tier_source IS NULL OR tier_source = ANY (ARRAY[
    'naka_balance','stripe','admin','legacy','founder_pass_nft','crypto'
  ]));
