-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — SESSION 5B-1 RELAYER GAP-FILL
-- Non-custodial pending-trades flow. All wallet sources
-- (builtin / external_evm / external_solana) go through
-- client-side confirmation. No server-side signing — ever.
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pending_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_reason TEXT NOT NULL CHECK (source_reason IN (
    'limit_order', 'dca', 'stop_loss', 'take_profit', 'trail_stop', 'copy_trade'
  )),
  source_order_id UUID,
  source_order_table TEXT CHECK (source_order_table IN (
    'limit_orders', 'dca_bots', 'stop_loss_orders', 'user_copy_trades'
  )),
  chain TEXT NOT NULL,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN (
    'external_evm', 'external_solana', 'builtin'
  )),
  from_token_address TEXT NOT NULL,
  from_token_symbol TEXT,
  to_token_address TEXT NOT NULL,
  to_token_symbol TEXT,
  amount_in NUMERIC NOT NULL,
  slippage_bps INTEGER NOT NULL DEFAULT 100,
  expected_amount_out NUMERIC,
  expected_price_usd NUMERIC,
  route_provider TEXT,
  route_data JSONB NOT NULL,
  security_trust_score INTEGER,
  security_is_honeypot BOOLEAN,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'rejected', 'expired', 'failed'
  )),
  confirmed_tx_hash TEXT,
  confirmed_at TIMESTAMPTZ,
  failure_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pending_trades_user_status_idx
  ON pending_trades(user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS pending_trades_source_idx
  ON pending_trades(source_order_table, source_order_id);
CREATE INDEX IF NOT EXISTS pending_trades_cleanup_idx
  ON pending_trades(expires_at) WHERE status = 'pending';

ALTER TABLE pending_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_pending_trades" ON pending_trades;
CREATE POLICY "users_own_pending_trades" ON pending_trades
  FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_pending_trades" ON pending_trades;
CREATE POLICY "service_role_pending_trades" ON pending_trades
  FOR ALL TO service_role USING (true);

-- Helpful read-through view: pending trades the app should show the user now.
CREATE OR REPLACE VIEW pending_trades_active AS
  SELECT *
  FROM pending_trades
  WHERE status = 'pending' AND expires_at > NOW();

GRANT SELECT ON pending_trades_active TO authenticated, service_role;
