-- Session 5A: Wallet auth + Telegram link tables
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS auth_wallet_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  chain TEXT NOT NULL CHECK (chain IN ('evm', 'solana')),
  nonce TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_wallet_nonces_address_idx ON auth_wallet_nonces(address);
CREATE INDEX IF NOT EXISTS auth_wallet_nonces_expires_idx ON auth_wallet_nonces(expires_at);
ALTER TABLE auth_wallet_nonces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_wallet_nonces" ON auth_wallet_nonces;
CREATE POLICY "service_role_wallet_nonces" ON auth_wallet_nonces FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS wallet_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  chain TEXT NOT NULL CHECK (chain IN ('evm', 'solana')),
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  is_primary BOOLEAN DEFAULT false,
  label TEXT,
  UNIQUE(address, chain)
);
CREATE INDEX IF NOT EXISTS wallet_identities_user_idx ON wallet_identities(user_id);
CREATE INDEX IF NOT EXISTS wallet_identities_address_idx ON wallet_identities(address);
ALTER TABLE wallet_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_wallet_identities" ON wallet_identities;
CREATE POLICY "service_role_wallet_identities" ON wallet_identities FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "users_own_wallet_identities" ON wallet_identities;
CREATE POLICY "users_own_wallet_identities" ON wallet_identities FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS user_telegram_links (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  link_code TEXT UNIQUE,
  link_code_expires_at TIMESTAMPTZ
);
ALTER TABLE user_telegram_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_tg_links" ON user_telegram_links;
CREATE POLICY "service_role_tg_links" ON user_telegram_links FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "users_own_tg_links" ON user_telegram_links;
CREATE POLICY "users_own_tg_links" ON user_telegram_links FOR ALL TO authenticated USING (user_id = auth.uid());
