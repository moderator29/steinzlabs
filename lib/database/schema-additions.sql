-- =====================================================
-- ADDITIONAL TABLES - Add to existing schema
-- =====================================================

-- =====================================================
-- HOLDER SNAPSHOTS TABLE (Historical tracking)
-- =====================================================
CREATE TABLE holder_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  holders JSONB NOT NULL,
  price DECIMAL(20, 10),
  volume24h DECIMAL(20, 2),
  liquidity DECIMAL(20, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_snapshots_token ON holder_snapshots(token_address);
CREATE INDEX idx_snapshots_timestamp ON holder_snapshots(timestamp);
CREATE INDEX idx_snapshots_token_time ON holder_snapshots(token_address, timestamp);

-- =====================================================
-- ENTITY TRADES TABLE (Historical entity trades)
-- =====================================================
CREATE TABLE entity_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  entry_date TIMESTAMP NOT NULL,
  entry_price DECIMAL(20, 10) NOT NULL,
  exit_date TIMESTAMP,
  exit_price DECIMAL(20, 10),
  hold_time INTEGER, -- days
  gain DECIMAL(10, 2), -- percentage
  amount_usd TEXT,
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, EXITED, RUG_PULLED
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entity_trades_entity ON entity_trades(entity_id);
CREATE INDEX idx_entity_trades_token ON entity_trades(token_address);
CREATE INDEX idx_entity_trades_status ON entity_trades(status);

-- =====================================================
-- TOKEN METADATA CACHE TABLE
-- =====================================================
CREATE TABLE token_metadata (
  address TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  decimals INTEGER,
  logo_url TEXT,
  total_supply TEXT,
  last_updated TIMESTAMP DEFAULT NOW()
);
