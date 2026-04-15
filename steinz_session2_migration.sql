-- ═══════════════════════════════════════════════════════════
-- Steinz Labs — Session 2 Additional Migration
-- Run AFTER steinz_migration.sql (from Session 1)
-- Safe to re-run (uses IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════

-- User preferences (settings persistence)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  whale_alerts BOOLEAN DEFAULT true,
  price_alerts BOOLEAN DEFAULT true,
  security_alerts BOOLEAN DEFAULT true,
  newsletter BOOLEAN DEFAULT false,
  email_whale BOOLEAN DEFAULT true,
  email_price BOOLEAN DEFAULT true,
  default_chain TEXT DEFAULT 'ethereum',
  default_slippage NUMERIC DEFAULT 0.5,
  gasless_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whale follows
CREATE TABLE IF NOT EXISTS user_whale_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, whale_address, chain)
);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_whale_follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users own preferences" ON user_preferences;
  DROP POLICY IF EXISTS "Users own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users own follows" ON user_whale_follows;
END $$;

CREATE POLICY "Users own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own follows" ON user_whale_follows
  FOR ALL USING (auth.uid() = user_id);
