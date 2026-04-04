-- =====================================================
-- STEINZ LABS - COMPLETE DATABASE SCHEMA ADDITIONS
-- Run in Supabase SQL Editor
-- =====================================================

-- HOLDER SNAPSHOTS TABLE (Historical tracking)
CREATE TABLE IF NOT EXISTS holder_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  holders JSONB,
  price DECIMAL(20, 10),
  volume24h DECIMAL(20, 2),
  volume DECIMAL(20, 2),
  liquidity DECIMAL(20, 2),
  snapshot_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_token ON holder_snapshots(token_address);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON holder_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_snapshots_token_time ON holder_snapshots(token_address, timestamp);

-- ENTITY TRADES TABLE (Historical entity trades)
CREATE TABLE IF NOT EXISTS entity_trades (
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
  hold_time INTEGER,
  gain DECIMAL(10, 2),
  amount_usd TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_trades_entity ON entity_trades(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_trades_token ON entity_trades(token_address);
CREATE INDEX IF NOT EXISTS idx_entity_trades_status ON entity_trades(status);

-- TOKEN METADATA CACHE TABLE
CREATE TABLE IF NOT EXISTS token_metadata (
  address TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  decimals INTEGER,
  logo_url TEXT,
  total_supply TEXT,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_chain ON token_metadata(chain);

-- LIMIT ORDERS TABLE
CREATE TABLE IF NOT EXISTS limit_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  side TEXT NOT NULL,
  target_price DECIMAL(20, 10) NOT NULL,
  amount DECIMAL(30, 10) NOT NULL,
  amount_usd TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  filled_at TIMESTAMP,
  tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_user ON limit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders(status);
CREATE INDEX IF NOT EXISTS idx_limit_orders_token ON limit_orders(token_address);

-- STOP LOSS ORDERS TABLE
CREATE TABLE IF NOT EXISTS stop_loss_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  stop_price DECIMAL(20, 10) NOT NULL,
  amount DECIMAL(30, 10) NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW(),
  triggered_at TIMESTAMP,
  tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_stop_loss_user ON stop_loss_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_stop_loss_status ON stop_loss_orders(status);

-- TAKE PROFIT ORDERS TABLE
CREATE TABLE IF NOT EXISTS take_profit_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  target_price DECIMAL(20, 10) NOT NULL,
  amount DECIMAL(30, 10) NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW(),
  triggered_at TIMESTAMP,
  tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_take_profit_user ON take_profit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_take_profit_status ON take_profit_orders(status);

-- DCA CONFIGURATIONS TABLE
CREATE TABLE IF NOT EXISTS dca_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  amount_per_buy DECIMAL(20, 10) NOT NULL,
  frequency TEXT NOT NULL,
  total_budget DECIMAL(20, 10),
  spent DECIMAL(20, 10) DEFAULT 0,
  buys_completed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  next_buy_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dca_user ON dca_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_dca_status ON dca_configs(status);

-- REVENUE RECORDS TABLE
CREATE TABLE IF NOT EXISTS revenue_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  trade_type TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  trade_amount TEXT NOT NULL,
  fee_amount TEXT NOT NULL,
  fee_bps INTEGER NOT NULL,
  treasury_wallet TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'PENDING',
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_user ON revenue_records(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_timestamp ON revenue_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_revenue_status ON revenue_records(status);
CREATE INDEX IF NOT EXISTS idx_revenue_type ON revenue_records(trade_type);

-- TREASURY BALANCE TABLE
CREATE TABLE IF NOT EXISTS treasury_balance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  balance TEXT NOT NULL,
  balance_usd TEXT NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(chain, token_address)
);

CREATE INDEX IF NOT EXISTS idx_treasury_chain ON treasury_balance(chain);

-- SUBSCRIPTION FIELDS ON USERS TABLE
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'FREE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;
