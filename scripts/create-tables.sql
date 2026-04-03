CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE,
  reputation_score INTEGER DEFAULT 50,
  reputation_status TEXT DEFAULT 'UNKNOWN',
  is_verified_entity BOOLEAN DEFAULT FALSE,
  entity_id TEXT,
  entity_name TEXT,
  blocked BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token_address TEXT NOT NULL,
  scan_result JSONB NOT NULL,
  allowed BOOLEAN NOT NULL,
  blocked BOOLEAN NOT NULL,
  risk_score INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'solana',
  entry_price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  value_usd NUMERIC,
  status TEXT DEFAULT 'ACTIVE',
  auto_exit_enabled BOOLEAN DEFAULT FALSE,
  following_entity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  severity TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  threat_type TEXT NOT NULL,
  threat_data JSONB NOT NULL,
  recommendation TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS followed_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT,
  wallets JSONB DEFAULT '[]'::jsonb,
  notify_trades BOOLEAN DEFAULT TRUE,
  notify_large_moves BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  alert_type TEXT NOT NULL,
  entity_id TEXT,
  token_address TEXT,
  condition_type TEXT NOT NULL,
  condition_value JSONB NOT NULL,
  triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,
  entity_data JSONB NOT NULL,
  portfolio_data JSONB,
  performance_data JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_token ON scans(token_address);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_threats_user ON threats(user_id);
CREATE INDEX IF NOT EXISTS idx_threats_unack ON threats(user_id, acknowledged);
CREATE INDEX IF NOT EXISTS idx_followed_user ON followed_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_cache_id ON entity_cache(entity_id);
