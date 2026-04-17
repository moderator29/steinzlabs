-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS SESSION 5B-1 BATCH 1 MIGRATION
-- Trading terminal: limit orders, DCA bots, stop-loss/TP
-- Swap: route analytics, execution history enhancement
-- Run ONCE in Supabase SQL Editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- LIMIT ORDERS
CREATE TABLE IF NOT EXISTS limit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  from_token_address TEXT NOT NULL,
  from_token_symbol TEXT,
  from_token_logo TEXT,
  to_token_address TEXT NOT NULL,
  to_token_symbol TEXT,
  to_token_logo TEXT,
  from_amount NUMERIC NOT NULL,
  trigger_price_usd NUMERIC NOT NULL,
  trigger_direction TEXT NOT NULL CHECK (trigger_direction IN ('above', 'below')),
  slippage_bps INTEGER DEFAULT 100,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'executed', 'cancelled', 'expired', 'failed')),
  executed_at TIMESTAMPTZ,
  executed_tx_hash TEXT,
  executed_amount_out NUMERIC,
  executed_price NUMERIC,
  failure_reason TEXT,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN ('external_evm', 'external_solana', 'builtin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS limit_orders_user_status_idx ON limit_orders(user_id, status);
CREATE INDEX IF NOT EXISTS limit_orders_active_monitoring_idx ON limit_orders(status, trigger_price_usd) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS limit_orders_token_idx ON limit_orders(to_token_address, status) WHERE status = 'active';
ALTER TABLE limit_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_limit_orders" ON limit_orders;
CREATE POLICY "users_own_limit_orders" ON limit_orders FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_limit_orders" ON limit_orders;
CREATE POLICY "service_role_limit_orders" ON limit_orders FOR ALL TO service_role USING (true);

-- DCA BOTS
CREATE TABLE IF NOT EXISTS dca_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  from_token_address TEXT NOT NULL,
  from_token_symbol TEXT,
  from_token_logo TEXT,
  to_token_address TEXT NOT NULL,
  to_token_symbol TEXT,
  to_token_logo TEXT,
  amount_per_execution NUMERIC NOT NULL,
  interval_seconds INTEGER NOT NULL CHECK (interval_seconds >= 3600),
  total_executions INTEGER,
  executions_completed INTEGER DEFAULT 0,
  total_invested_usd NUMERIC DEFAULT 0,
  total_received_amount NUMERIC DEFAULT 0,
  avg_entry_price NUMERIC,
  next_execution_at TIMESTAMPTZ NOT NULL,
  last_execution_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'failed')),
  slippage_bps INTEGER DEFAULT 100,
  max_price_usd NUMERIC,
  min_price_usd NUMERIC,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN ('external_evm', 'external_solana', 'builtin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dca_bots_user_status_idx ON dca_bots(user_id, status);
CREATE INDEX IF NOT EXISTS dca_bots_next_execution_idx ON dca_bots(next_execution_at) WHERE status = 'active';
ALTER TABLE dca_bots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_dca_bots" ON dca_bots;
CREATE POLICY "users_own_dca_bots" ON dca_bots FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_dca_bots" ON dca_bots;
CREATE POLICY "service_role_dca_bots" ON dca_bots FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS dca_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES dca_bots(id) ON DELETE CASCADE,
  execution_number INTEGER NOT NULL,
  tx_hash TEXT,
  amount_in NUMERIC NOT NULL,
  amount_out NUMERIC,
  price_at_execution NUMERIC,
  gas_usd NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  failure_reason TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dca_executions_bot_idx ON dca_executions(bot_id, executed_at DESC);
ALTER TABLE dca_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_dca_executions" ON dca_executions;
CREATE POLICY "users_read_own_dca_executions" ON dca_executions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM dca_bots WHERE dca_bots.id = dca_executions.bot_id AND dca_bots.user_id = auth.uid())
);
DROP POLICY IF EXISTS "service_role_dca_executions" ON dca_executions;
CREATE POLICY "service_role_dca_executions" ON dca_executions FOR ALL TO service_role USING (true);

-- STOP LOSS / TAKE PROFIT
CREATE TABLE IF NOT EXISTS stop_loss_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  token_logo TEXT,
  position_amount NUMERIC NOT NULL,
  entry_price_usd NUMERIC,
  stop_loss_price_usd NUMERIC,
  take_profit_price_usd NUMERIC,
  trailing_stop_percent NUMERIC,
  highest_price_seen NUMERIC,
  exit_to_token_address TEXT NOT NULL,
  exit_to_token_symbol TEXT,
  slippage_bps INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered_sl', 'triggered_tp', 'triggered_trail', 'cancelled', 'expired', 'failed')),
  triggered_at TIMESTAMPTZ,
  triggered_tx_hash TEXT,
  triggered_price NUMERIC,
  realized_pnl_usd NUMERIC,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN ('external_evm', 'external_solana', 'builtin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stop_loss_user_status_idx ON stop_loss_orders(user_id, status);
CREATE INDEX IF NOT EXISTS stop_loss_active_idx ON stop_loss_orders(token_address, status) WHERE status = 'active';
ALTER TABLE stop_loss_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_stop_loss" ON stop_loss_orders;
CREATE POLICY "users_own_stop_loss" ON stop_loss_orders FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_stop_loss" ON stop_loss_orders;
CREATE POLICY "service_role_stop_loss" ON stop_loss_orders FOR ALL TO service_role USING (true);

-- SWAP ROUTE ANALYTICS
CREATE TABLE IF NOT EXISTS swap_route_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL,
  from_token TEXT NOT NULL,
  to_token TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('0x', 'jupiter', '1inch', 'cowswap', 'kyberswap', 'openocean')),
  quote_price NUMERIC,
  executed_price NUMERIC,
  price_impact_bps INTEGER,
  slippage_bps INTEGER,
  gas_usd NUMERIC,
  savings_vs_next_best_usd NUMERIC,
  mev_protection_used BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tx_hash TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS swap_route_pair_idx ON swap_route_analytics(from_token, to_token, captured_at DESC);
CREATE INDEX IF NOT EXISTS swap_route_provider_idx ON swap_route_analytics(provider, captured_at DESC);
ALTER TABLE swap_route_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_swap_analytics" ON swap_route_analytics;
CREATE POLICY "authenticated_read_swap_analytics" ON swap_route_analytics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_swap_analytics" ON swap_route_analytics;
CREATE POLICY "service_role_swap_analytics" ON swap_route_analytics FOR ALL TO service_role USING (true);

-- TRADING PREFERENCES PER USER
CREATE TABLE IF NOT EXISTS user_trading_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_slippage_bps INTEGER DEFAULT 100,
  expert_mode BOOLEAN DEFAULT false,
  auto_approve_under_usd NUMERIC DEFAULT 0,
  preferred_dex_route TEXT DEFAULT 'best_price',
  mev_protection_enabled BOOLEAN DEFAULT true,
  default_chart_timeframe TEXT DEFAULT '1h',
  default_indicators JSONB DEFAULT '["ema_20", "ema_50"]'::jsonb,
  last_used_token_from TEXT,
  last_used_token_to TEXT,
  last_used_chain TEXT,
  favorite_pairs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_trading_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_trading_prefs" ON user_trading_preferences;
CREATE POLICY "users_own_trading_prefs" ON user_trading_preferences FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_trading_prefs" ON user_trading_preferences;
CREATE POLICY "service_role_trading_prefs" ON user_trading_preferences FOR ALL TO service_role USING (true);

-- CHART DRAWINGS PERSISTENCE
CREATE TABLE IF NOT EXISTS user_chart_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  drawings JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token_address, chain)
);
CREATE INDEX IF NOT EXISTS chart_drawings_user_token_idx ON user_chart_drawings(user_id, token_address);
ALTER TABLE user_chart_drawings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_drawings" ON user_chart_drawings;
CREATE POLICY "users_own_drawings" ON user_chart_drawings FOR ALL TO authenticated USING (user_id = auth.uid());

-- PRICE ALERT FROM CHART
CREATE TABLE IF NOT EXISTS chart_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  token_symbol TEXT,
  trigger_price_usd NUMERIC NOT NULL,
  trigger_direction TEXT NOT NULL CHECK (trigger_direction IN ('above', 'below')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled')),
  notification_channels JSONB DEFAULT '["push", "telegram"]'::jsonb,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chart_alerts_user_idx ON chart_price_alerts(user_id, status);
CREATE INDEX IF NOT EXISTS chart_alerts_monitoring_idx ON chart_price_alerts(token_address, status) WHERE status = 'active';
ALTER TABLE chart_price_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_chart_alerts" ON chart_price_alerts;
CREATE POLICY "users_own_chart_alerts" ON chart_price_alerts FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_chart_alerts" ON chart_price_alerts;
CREATE POLICY "service_role_chart_alerts" ON chart_price_alerts FOR ALL TO service_role USING (true);
