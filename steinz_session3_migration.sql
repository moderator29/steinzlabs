-- ═══════════════════════════════════════════════════════════════
-- STEINZ LABS — Session 3 Migration
-- Run after steinz_migration.sql and steinz_session2_migration.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── Swap Logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swap_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT,
  user_id UUID REFERENCES auth.users(id),
  chain TEXT NOT NULL,
  input_token TEXT NOT NULL,
  output_token TEXT NOT NULL,
  input_amount NUMERIC,
  output_amount NUMERIC,
  status TEXT DEFAULT 'confirmed',
  tx_hash TEXT,
  swap_type TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_logs_wallet ON swap_logs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_swap_logs_tx ON swap_logs(tx_hash);

-- ─── Fee Revenue ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT,
  user_id UUID REFERENCES auth.users(id),
  tx_hash TEXT,
  chain TEXT NOT NULL,
  fee_usd NUMERIC DEFAULT 0,
  fee_bps INTEGER DEFAULT 40,
  input_token TEXT,
  output_token TEXT,
  input_value_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_revenue_wallet ON fee_revenue(wallet_address);

-- ─── Platform Settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO platform_settings (key, enabled) VALUES
  ('swap_enabled', true),
  ('sniper_enabled', true),
  ('ai_predictions', true),
  ('cluster_detection', true),
  ('smart_money_feed', true),
  ('security_scans', true),
  ('bubblemaps', true),
  ('portfolio_tracker', true),
  ('new_user_registration', true),
  ('maintenance_mode', false)
ON CONFLICT (key) DO NOTHING;

-- ─── Sniper Executions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sniper_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  token_address TEXT NOT NULL,
  chain TEXT DEFAULT 'ethereum',
  amount_in NUMERIC,
  slippage NUMERIC DEFAULT 1,
  status TEXT DEFAULT 'pending',
  tx_hash TEXT,
  amount_out NUMERIC,
  price_usd NUMERIC,
  risk_score NUMERIC,
  blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sniper_exec_user ON sniper_executions(user_id);

-- ─── Watchlist (verify exists + add auth policy) ────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);

-- ─── User Whale Follows ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_whale_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  whale_address TEXT NOT NULL,
  chain TEXT DEFAULT 'ethereum',
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, whale_address)
);

-- ─── Announcements (for admin) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ─── Featured Tokens (for admin) ───────────────────────────────
CREATE TABLE IF NOT EXISTS featured_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  chain TEXT DEFAULT 'ethereum',
  symbol TEXT,
  name TEXT,
  added_by TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_address, chain)
);

-- ─── Seed whale_addresses with real addresses ──────────────────
INSERT INTO whale_addresses (address, chain, label, category) VALUES
  ('0x28C6c06298d514Db089934071355E5743bf21d60', 'ethereum', 'Binance 14', 'Exchange'),
  ('0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', 'ethereum', 'Binance 7', 'Exchange'),
  ('0x71660c4005BA85c37ccec55d0C4493E66Fe775d3', 'ethereum', 'Coinbase 4', 'Exchange'),
  ('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 'ethereum', 'vitalik.eth', 'Individual'),
  ('0x176F3DAb24a159341c0509bB36B833E7fdd0a132', 'ethereum', 'Justin Sun', 'Individual'),
  ('0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', 'ethereum', 'Binance Founder', 'Individual'),
  ('0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0', 'ethereum', 'Jump Trading', 'Fund'),
  ('0xF977814e90dA44bFA03b6295A0616a897441aceC', 'ethereum', 'Binance 8', 'Exchange'),
  ('0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', 'ethereum', 'Wintermute', 'Market Maker'),
  ('0x0000000000000000000000000000000000001004', 'ethereum', 'Binance Deposit', 'Exchange'),
  ('0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', 'ethereum', 'Binance 6', 'Exchange'),
  ('0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2', 'ethereum', 'FTX Exchange', 'Exchange'),
  ('0x5a52E96BAcdaBb82fd05763E25335261B270Efcb', 'ethereum', 'Robinhood', 'Exchange'),
  ('0x9696f59E4d72E237BE84fFD425DCaD154Bf96976', 'ethereum', 'Cumberland DRW', 'Fund'),
  ('0x1B3cB81E51011b549d78bf720b0d924ac763A7C2', 'ethereum', 'Grayscale', 'Fund'),
  ('Ct3Vb7Yxj4JvPQ5rfqLNnxkBCWkbR7gHSpCerDnzBtvz', 'solana', 'Binance SOL', 'Exchange'),
  ('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', 'solana', 'Raydium Authority', 'DEX'),
  ('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana', 'FTX SOL', 'Exchange'),
  ('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', 'solana', 'Alameda Research', 'Fund'),
  ('4yttKWzRoNYS2HekxDfcZYmfQqnVWpKiJ14XUiWHPMro', 'solana', 'Jump Crypto SOL', 'Fund')
ON CONFLICT DO NOTHING;

-- ─── Enable RLS ────────────────────────────────────────────────
ALTER TABLE swap_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sniper_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_whale_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for API routes)
CREATE POLICY IF NOT EXISTS "service_role_swap_logs" ON swap_logs FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_fee_revenue" ON fee_revenue FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_sniper_exec" ON sniper_executions FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_watchlist" ON watchlist FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_whale_follows" ON user_whale_follows FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_announcements" ON announcements FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_featured_tokens" ON featured_tokens FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_platform_settings" ON platform_settings FOR ALL TO service_role USING (true);
