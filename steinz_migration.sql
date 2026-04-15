-- ═══════════════════════════════════════════════════════════
-- Steinz Labs — Complete Database Migration
-- Run this in Supabase SQL Editor as a single operation
-- ═══════════════════════════════════════════════════════════

-- User Wallets (encrypted private keys, cross-device recovery)
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  encrypted_private_key TEXT NOT NULL,
  wallet_name TEXT DEFAULT 'My Wallet',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wallet_address)
);

-- Transactions (swap history, sends, receives)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  type TEXT NOT NULL,
  from_token_address TEXT,
  from_token_symbol TEXT,
  from_token_logo TEXT,
  to_token_address TEXT,
  to_token_symbol TEXT,
  to_token_logo TEXT,
  from_amount NUMERIC,
  to_amount NUMERIC,
  usd_value NUMERIC,
  platform_fee_usd NUMERIC DEFAULT 0,
  gas_fee_usd NUMERIC,
  status TEXT DEFAULT 'pending',
  error_reason TEXT,
  explorer_url TEXT,
  swap_type TEXT DEFAULT 'standard',
  gasless BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Research Posts (admin-published content for Research Lab)
CREATE TABLE IF NOT EXISTS research_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  author_id UUID REFERENCES auth.users(id),
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price Alerts
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_logo TEXT,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  alert_type TEXT NOT NULL,
  target_price NUMERIC NOT NULL,
  current_price_at_creation NUMERIC,
  triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Fees (revenue tracking for admin panel)
CREATE TABLE IF NOT EXISTS platform_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  fee_amount_usd NUMERIC NOT NULL,
  fee_amount_token NUMERIC,
  fee_token_symbol TEXT,
  fee_percentage NUMERIC DEFAULT 0.004,
  chain TEXT NOT NULL,
  treasury_wallet TEXT NOT NULL,
  swap_type TEXT DEFAULT 'standard',
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whale Addresses (tracked large wallets)
CREATE TABLE IF NOT EXISTS whale_addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  label TEXT,
  category TEXT,
  last_activity TIMESTAMPTZ,
  total_value_usd NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain)
);

-- Trade Analytics Cache (0x Trade Analytics API cache)
CREATE TABLE IF NOT EXISTS trade_analytics_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_type TEXT NOT NULL,
  chain_id INTEGER,
  aggregated_data JSONB NOT NULL,
  period TEXT DEFAULT 'daily',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes'
);

-- ═══════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════

ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE whale_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_analytics_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe re-run)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users own wallets" ON user_wallets;
  DROP POLICY IF EXISTS "Users own transactions" ON transactions;
  DROP POLICY IF EXISTS "Anyone reads published posts" ON research_posts;
  DROP POLICY IF EXISTS "Admins manage posts" ON research_posts;
  DROP POLICY IF EXISTS "Users own alerts" ON price_alerts;
  DROP POLICY IF EXISTS "Admins read fees" ON platform_fees;
  DROP POLICY IF EXISTS "Admins manage whales" ON whale_addresses;
  DROP POLICY IF EXISTS "Anyone reads analytics cache" ON trade_analytics_cache;
  DROP POLICY IF EXISTS "Server manages analytics cache" ON trade_analytics_cache;
END $$;

CREATE POLICY "Users own wallets" ON user_wallets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone reads published posts" ON research_posts
  FOR SELECT USING (published = true);

CREATE POLICY "Admins manage posts" ON research_posts
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

CREATE POLICY "Users own alerts" ON price_alerts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins read fees" ON platform_fees
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

CREATE POLICY "Admins manage whales" ON whale_addresses
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

CREATE POLICY "Anyone reads analytics cache" ON trade_analytics_cache
  FOR SELECT USING (true);

CREATE POLICY "Server manages analytics cache" ON trade_analytics_cache
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );
