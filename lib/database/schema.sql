-- =====================================================
-- STEINZ LABS DATABASE SCHEMA
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  reputation_score INTEGER DEFAULT 50,
  reputation_status TEXT DEFAULT 'UNKNOWN', -- VERIFIED, UNKNOWN, SUSPICIOUS, DANGEROUS
  is_verified_entity BOOLEAN DEFAULT FALSE,
  entity_id TEXT, -- Arkham entity ID if verified
  entity_name TEXT,
  blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_entity ON users(entity_id);

-- =====================================================
-- TRADING POSITIONS TABLE
-- =====================================================
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  entry_price DECIMAL(20, 10) NOT NULL,
  amount DECIMAL(30, 10) NOT NULL,
  value_usd DECIMAL(20, 2),
  auto_exit_enabled BOOLEAN DEFAULT FALSE,
  following_entity TEXT, -- Entity ID they're copying
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, EXITED, STOPPED_OUT
  created_at TIMESTAMP DEFAULT NOW(),
  exited_at TIMESTAMP,
  exit_price DECIMAL(20, 10),
  pnl_usd DECIMAL(20, 2)
);

CREATE INDEX idx_positions_user ON positions(user_id);
CREATE INDEX idx_positions_token ON positions(token_address);
CREATE INDEX idx_positions_status ON positions(status);

-- =====================================================
-- SHADOW GUARDIAN SCANS TABLE
-- =====================================================
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  scan_result JSONB NOT NULL, -- Full ScanResult object
  allowed BOOLEAN NOT NULL,
  blocked BOOLEAN NOT NULL,
  risk_score INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scans_user ON scans(user_id);
CREATE INDEX idx_scans_token ON scans(token_address);
CREATE INDEX idx_scans_blocked ON scans(blocked);

-- =====================================================
-- PORTFOLIO THREATS TABLE
-- =====================================================
CREATE TABLE threats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL, -- CRITICAL, WARNING, INFO
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  threat_type TEXT NOT NULL, -- SCAMMER_IN_HOLDERS, LIQUIDITY_RISK, etc.
  threat_data JSONB NOT NULL,
  recommendation TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_threats_user ON threats(user_id);
CREATE INDEX idx_threats_severity ON threats(severity);
CREATE INDEX idx_threats_acknowledged ON threats(acknowledged);

-- =====================================================
-- FOLLOWED ENTITIES TABLE (Money Radar)
-- =====================================================
CREATE TABLE followed_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT, -- Market Maker, VC, Whale
  wallets TEXT[], -- Array of wallet addresses
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, entity_id)
);

CREATE INDEX idx_followed_user ON followed_entities(user_id);
CREATE INDEX idx_followed_entity ON followed_entities(entity_id);

-- =====================================================
-- ALERTS TABLE
-- =====================================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- PRICE, VOLUME, WHALE, ENTITY_MOVEMENT, SCAMMER
  condition JSONB NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_active ON alerts(active);

-- =====================================================
-- ARKHAM ENTITY CACHE TABLE
-- =====================================================
CREATE TABLE entity_cache (
  entity_id TEXT PRIMARY KEY,
  entity_data JSONB NOT NULL,
  performance_data JSONB,
  portfolio_data JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entity_updated ON entity_cache(updated_at);
