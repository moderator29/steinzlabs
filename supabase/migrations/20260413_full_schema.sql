-- =============================================================
-- STEINZ LABS — Full schema migration
-- Run this in Supabase SQL editor (service role / postgres)
-- Safe to run multiple times (IF NOT EXISTS everywhere)
-- =============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================
-- 1. PROFILES
-- Extends Supabase auth.users 1-to-1
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT        UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  tier          TEXT        NOT NULL DEFAULT 'free',  -- free | pro | elite
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- 2. USERS (extended metadata, separate from profiles)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        UNIQUE NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'user',  -- user | admin
  plan          TEXT        NOT NULL DEFAULT 'free',
  banned        BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = auth_id);

-- =============================================================
-- 3. WALLET ACCOUNTS
-- =============================================================
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address       TEXT        NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'solana',  -- solana | evm | bitcoin
  label         TEXT,
  is_primary    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_accounts_user_address
  ON wallet_accounts (user_id, address, chain);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts (user_id);

ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_accounts_own" ON wallet_accounts
  USING (auth.uid() = user_id);
CREATE POLICY "wallet_accounts_insert_own" ON wallet_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wallet_accounts_delete_own" ON wallet_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- 4. TRANSACTION HISTORY
-- =============================================================
CREATE TABLE IF NOT EXISTS transaction_history (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet        TEXT        NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  tx_hash       TEXT        NOT NULL,
  tx_type       TEXT,       -- swap | transfer | stake | approve | unknown
  token_in      TEXT,
  token_out     TEXT,
  amount_in     NUMERIC,
  amount_out    NUMERIC,
  usd_value     NUMERIC,
  timestamp     TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_history_hash ON transaction_history (tx_hash, chain);
CREATE INDEX IF NOT EXISTS idx_tx_history_user ON transaction_history (user_id);
CREATE INDEX IF NOT EXISTS idx_tx_history_wallet ON transaction_history (wallet);
CREATE INDEX IF NOT EXISTS idx_tx_history_ts ON transaction_history (timestamp DESC);

ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_history_own" ON transaction_history USING (auth.uid() = user_id);

-- =============================================================
-- 5. TOKEN APPROVALS
-- =============================================================
CREATE TABLE IF NOT EXISTS token_approvals (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet        TEXT        NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'evm',
  token         TEXT        NOT NULL,
  spender       TEXT        NOT NULL,
  allowance     TEXT,       -- "unlimited" or numeric string
  risk_level    TEXT        DEFAULT 'unknown',  -- safe | moderate | high | critical
  revoked       BOOLEAN     NOT NULL DEFAULT false,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_approvals_user ON token_approvals (user_id);
CREATE INDEX IF NOT EXISTS idx_token_approvals_wallet ON token_approvals (wallet);

ALTER TABLE token_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "token_approvals_own" ON token_approvals USING (auth.uid() = user_id);

-- =============================================================
-- 6. POSITIONS  (open trading positions)
-- =============================================================
CREATE TABLE IF NOT EXISTS positions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id      TEXT        NOT NULL,
  token_symbol  TEXT        NOT NULL,
  entry_price   NUMERIC     NOT NULL,
  current_price NUMERIC,
  quantity      NUMERIC     NOT NULL,
  usd_value     NUMERIC,
  pnl           NUMERIC,
  pnl_pct       NUMERIC,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  status        TEXT        NOT NULL DEFAULT 'open',  -- open | closed
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions (user_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions (status);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_own" ON positions USING (auth.uid() = user_id);

-- =============================================================
-- 7. LIMIT ORDERS
-- =============================================================
CREATE TABLE IF NOT EXISTS limit_orders (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_in      TEXT        NOT NULL,
  token_out     TEXT        NOT NULL,
  amount_in     NUMERIC     NOT NULL,
  limit_price   NUMERIC     NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  status        TEXT        NOT NULL DEFAULT 'pending',  -- pending | filled | cancelled | expired
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  filled_at     TIMESTAMPTZ,
  tx_hash       TEXT
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_user ON limit_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders (status);

ALTER TABLE limit_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "limit_orders_own" ON limit_orders USING (auth.uid() = user_id);

-- =============================================================
-- 8. STOP LOSS ORDERS
-- =============================================================
CREATE TABLE IF NOT EXISTS stop_loss_orders (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id      TEXT        NOT NULL,
  token_symbol  TEXT        NOT NULL,
  trigger_price NUMERIC     NOT NULL,
  quantity      NUMERIC     NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  status        TEXT        NOT NULL DEFAULT 'active',  -- active | triggered | cancelled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at  TIMESTAMPTZ,
  tx_hash       TEXT
);

CREATE INDEX IF NOT EXISTS idx_stop_loss_user ON stop_loss_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_stop_loss_status ON stop_loss_orders (status);

ALTER TABLE stop_loss_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stop_loss_own" ON stop_loss_orders USING (auth.uid() = user_id);

-- =============================================================
-- 9. TAKE PROFIT ORDERS
-- =============================================================
CREATE TABLE IF NOT EXISTS take_profit_orders (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id      TEXT        NOT NULL,
  token_symbol  TEXT        NOT NULL,
  trigger_price NUMERIC     NOT NULL,
  quantity      NUMERIC     NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  status        TEXT        NOT NULL DEFAULT 'active',  -- active | triggered | cancelled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at  TIMESTAMPTZ,
  tx_hash       TEXT
);

CREATE INDEX IF NOT EXISTS idx_take_profit_user ON take_profit_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_take_profit_status ON take_profit_orders (status);

ALTER TABLE take_profit_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "take_profit_own" ON take_profit_orders USING (auth.uid() = user_id);

-- =============================================================
-- 10. DCA CONFIGS  (dollar-cost-average plans)
-- =============================================================
CREATE TABLE IF NOT EXISTS dca_configs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_in        TEXT        NOT NULL,
  token_out       TEXT        NOT NULL,
  amount_per_run  NUMERIC     NOT NULL,
  interval_hours  INTEGER     NOT NULL DEFAULT 24,
  chain           TEXT        NOT NULL DEFAULT 'solana',
  status          TEXT        NOT NULL DEFAULT 'active',  -- active | paused | completed
  runs_completed  INTEGER     NOT NULL DEFAULT 0,
  max_runs        INTEGER,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dca_configs_user ON dca_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_dca_configs_status ON dca_configs (status);

ALTER TABLE dca_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dca_configs_own" ON dca_configs USING (auth.uid() = user_id);

-- =============================================================
-- 11. SNIPER EXECUTIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS sniper_executions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address TEXT        NOT NULL,
  token_symbol  TEXT,
  amount_sol    NUMERIC,
  slippage_bps  INTEGER,
  status        TEXT        NOT NULL DEFAULT 'pending',  -- pending | success | failed
  tx_hash       TEXT,
  error_msg     TEXT,
  executed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sniper_user ON sniper_executions (user_id);
CREATE INDEX IF NOT EXISTS idx_sniper_status ON sniper_executions (status);

ALTER TABLE sniper_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sniper_own" ON sniper_executions USING (auth.uid() = user_id);

-- =============================================================
-- 12. SWAP LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS swap_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_in      TEXT        NOT NULL,
  token_out     TEXT        NOT NULL,
  amount_in     NUMERIC     NOT NULL,
  amount_out    NUMERIC,
  price_impact  NUMERIC,
  fee_usd       NUMERIC,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  dex           TEXT,
  status        TEXT        NOT NULL DEFAULT 'success',
  tx_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swap_logs_user ON swap_logs (user_id);

ALTER TABLE swap_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swap_logs_own" ON swap_logs USING (auth.uid() = user_id);

-- =============================================================
-- 13. ALERTS
-- =============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type    TEXT        NOT NULL,  -- price | whale | smart_money | custom
  label         TEXT        NOT NULL,
  condition     JSONB       NOT NULL DEFAULT '{}',
  triggered     BOOLEAN     NOT NULL DEFAULT false,
  triggered_at  TIMESTAMPTZ,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (active);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_own" ON alerts USING (auth.uid() = user_id);

-- =============================================================
-- 14. PRICE ALERTS
-- =============================================================
CREATE TABLE IF NOT EXISTS price_alerts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id      TEXT        NOT NULL,
  token_symbol  TEXT        NOT NULL,
  direction     TEXT        NOT NULL DEFAULT 'above',  -- above | below
  price         NUMERIC     NOT NULL,
  triggered     BOOLEAN     NOT NULL DEFAULT false,
  triggered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_triggered ON price_alerts (triggered);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_alerts_own" ON price_alerts USING (auth.uid() = user_id);

-- =============================================================
-- 15. FOLLOWED ENTITIES
-- =============================================================
CREATE TABLE IF NOT EXISTS followed_entities (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type   TEXT        NOT NULL,  -- wallet | token | protocol
  entity_id     TEXT        NOT NULL,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_followed_entities_unique
  ON followed_entities (user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_followed_entities_user ON followed_entities (user_id);

ALTER TABLE followed_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followed_entities_own" ON followed_entities USING (auth.uid() = user_id);

-- =============================================================
-- 16. CONTACTS  (address book)
-- =============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address       TEXT        NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  label         TEXT,
  tags          TEXT[]      DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique ON contacts (user_id, address, chain);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts (user_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_own" ON contacts USING (auth.uid() = user_id);

-- =============================================================
-- 17. WATCHLIST  (market watchlist)
-- =============================================================
CREATE TABLE IF NOT EXISTS watchlist (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id      TEXT        NOT NULL,
  token_symbol  TEXT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_unique ON watchlist (user_id, token_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist (user_id);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_own" ON watchlist USING (auth.uid() = user_id);

-- =============================================================
-- 18. WHALE WATCHLIST
-- =============================================================
CREATE TABLE IF NOT EXISTS whale_watchlist (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address       TEXT        NOT NULL,
  label         TEXT,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whale_watchlist_unique ON whale_watchlist (user_id, address);
CREATE INDEX IF NOT EXISTS idx_whale_watchlist_user ON whale_watchlist (user_id);

ALTER TABLE whale_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whale_watchlist_own" ON whale_watchlist USING (auth.uid() = user_id);

-- =============================================================
-- 19. WALLET CLUSTERS
-- =============================================================
CREATE TABLE IF NOT EXISTS wallet_clusters (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id    TEXT        NOT NULL UNIQUE,
  behavior_type TEXT,        -- accumulation | distribution | pump | wash_trading | unknown
  whale_score   NUMERIC,
  token_address TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_clusters_behavior ON wallet_clusters (behavior_type);

-- =============================================================
-- 20. WALLET CLUSTER MEMBERS
-- =============================================================
CREATE TABLE IF NOT EXISTS wallet_cluster_members (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id    TEXT        NOT NULL REFERENCES wallet_clusters(cluster_id) ON DELETE CASCADE,
  address       TEXT        NOT NULL,
  role          TEXT        DEFAULT 'member',  -- leader | member
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wcm_unique ON wallet_cluster_members (cluster_id, address);
CREATE INDEX IF NOT EXISTS idx_wcm_cluster ON wallet_cluster_members (cluster_id);

-- =============================================================
-- 21. WALLET PROFILES
-- =============================================================
CREATE TABLE IF NOT EXISTS wallet_profiles (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  address       TEXT        NOT NULL UNIQUE,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  label         TEXT,
  tags          TEXT[]      DEFAULT '{}',
  risk_score    NUMERIC,
  whale_score   NUMERIC,
  entity_type   TEXT,       -- fund | individual | protocol | unknown
  first_seen    TIMESTAMPTZ,
  last_seen     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_profiles_address ON wallet_profiles (address);

-- =============================================================
-- 22. SMART MONEY WALLETS
-- =============================================================
CREATE TABLE IF NOT EXISTS smart_money_wallets (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  address       TEXT        NOT NULL UNIQUE,
  label         TEXT,
  win_rate      NUMERIC,
  avg_return    NUMERIC,
  total_pnl_usd NUMERIC,
  trades_count  INTEGER,
  tier          TEXT        DEFAULT 'unknown',  -- legendary | elite | smart | retail
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smart_money_tier ON smart_money_wallets (tier);

-- =============================================================
-- 23. HOLDER SNAPSHOTS
-- =============================================================
CREATE TABLE IF NOT EXISTS holder_snapshots (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_address TEXT        NOT NULL,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  holder_count  INTEGER,
  top10_pct     NUMERIC,
  snapped_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holder_snapshots_token ON holder_snapshots (token_address);
CREATE INDEX IF NOT EXISTS idx_holder_snapshots_ts ON holder_snapshots (snapped_at DESC);

-- =============================================================
-- 24. NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'info',  -- info | alert | success | warning
  read          BOOLEAN     NOT NULL DEFAULT false,
  url           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_ts ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications USING (auth.uid() = user_id);

-- =============================================================
-- 25. NOTIFICATION SETTINGS
-- =============================================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled     BOOLEAN     NOT NULL DEFAULT false,
  whale_alerts     BOOLEAN     NOT NULL DEFAULT true,
  smart_money      BOOLEAN     NOT NULL DEFAULT true,
  price_alerts     BOOLEAN     NOT NULL DEFAULT true,
  security_alerts  BOOLEAN     NOT NULL DEFAULT true,
  weekly_digest    BOOLEAN     NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_settings_own" ON notification_settings USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION handle_new_user_notification_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notification_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_notif_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_notif_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_notification_settings();

-- =============================================================
-- 26. PUSH SUBSCRIPTIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT        NOT NULL UNIQUE,
  p256dh        TEXT        NOT NULL,
  auth          TEXT        NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subs_own" ON push_subscriptions USING (auth.uid() = user_id);

-- =============================================================
-- 27. PUSH DELIVERY LOG
-- =============================================================
CREATE TABLE IF NOT EXISTS push_delivery_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID        REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  notification_id UUID,
  title           TEXT,
  status          TEXT        NOT NULL DEFAULT 'sent',  -- sent | failed | expired
  status_code     INTEGER,
  error_msg       TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_delivery_log (user_id);
CREATE INDEX IF NOT EXISTS idx_push_log_ts ON push_delivery_log (sent_at DESC);

-- =============================================================
-- 28. SCANS  (security scans / contract analyzer)
-- =============================================================
CREATE TABLE IF NOT EXISTS scans (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  target        TEXT        NOT NULL,   -- address or domain
  scan_type     TEXT        NOT NULL,   -- contract | domain | wallet | token
  chain         TEXT        DEFAULT 'evm',
  risk_level    TEXT,        -- safe | low | medium | high | critical
  findings      JSONB       DEFAULT '[]',
  summary       TEXT,
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_user ON scans (user_id);
CREATE INDEX IF NOT EXISTS idx_scans_target ON scans (target);
CREATE INDEX IF NOT EXISTS idx_scans_ts ON scans (scanned_at DESC);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scans_own" ON scans USING (auth.uid() = user_id OR user_id IS NULL);

-- =============================================================
-- 29. THREATS  (known threat addresses / domains)
-- =============================================================
CREATE TABLE IF NOT EXISTS threats (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  target        TEXT        NOT NULL UNIQUE,
  threat_type   TEXT        NOT NULL,  -- phishing | drainer | rugpull | scam
  severity      TEXT        NOT NULL DEFAULT 'high',
  description   TEXT,
  source        TEXT,
  confirmed     BOOLEAN     NOT NULL DEFAULT false,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threats_target ON threats (target);
CREATE INDEX IF NOT EXISTS idx_threats_type ON threats (threat_type);

-- =============================================================
-- 30. RESEARCH POSTS
-- =============================================================
CREATE TABLE IF NOT EXISTS research_posts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT        UNIQUE,
  title         TEXT        NOT NULL,
  excerpt       TEXT,
  content       TEXT        NOT NULL DEFAULT '',
  cover_image   TEXT,       -- Supabase Storage public URL
  author        TEXT        NOT NULL DEFAULT 'Steinz Labs',
  status        TEXT        NOT NULL DEFAULT 'draft',  -- draft | published | archived
  tags          TEXT[]      DEFAULT '{}',
  read_time     INTEGER     DEFAULT 5,  -- estimated minutes
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_posts_status ON research_posts (status);
CREATE INDEX IF NOT EXISTS idx_research_posts_published ON research_posts (published_at DESC);

ALTER TABLE research_posts ENABLE ROW LEVEL SECURITY;
-- Public: anyone can read published posts
CREATE POLICY "research_posts_public_read" ON research_posts
  FOR SELECT USING (status = 'published');
-- Admin: service role can do everything (enforced at API layer via ADMIN_BEARER_TOKEN)
CREATE POLICY "research_posts_service_write" ON research_posts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================
-- 31. BROADCASTS  (admin announcements)
-- =============================================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'info',  -- info | warning | maintenance | feature
  active        BOOLEAN     NOT NULL DEFAULT true,
  pinned        BOOLEAN     NOT NULL DEFAULT false,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON broadcasts (active);

-- Public read for active broadcasts
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcasts_public_read" ON broadcasts FOR SELECT USING (active = true);
CREATE POLICY "broadcasts_service_write" ON broadcasts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================
-- 32. ENGAGEMENT  (post views / likes)
-- =============================================================
CREATE TABLE IF NOT EXISTS engagement (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id       UUID        REFERENCES research_posts(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,  -- view | like | share
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_post ON engagement (post_id);
CREATE INDEX IF NOT EXISTS idx_engagement_user ON engagement (user_id);

ALTER TABLE engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engagement_insert_any" ON engagement FOR INSERT WITH CHECK (true);
CREATE POLICY "engagement_own_select" ON engagement FOR SELECT USING (auth.uid() = user_id);

-- =============================================================
-- 33. PLATFORM SETTINGS  (singleton admin config row)
-- =============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id                    INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  maintenance_mode      BOOLEAN     NOT NULL DEFAULT false,
  registration_open     BOOLEAN     NOT NULL DEFAULT true,
  max_free_wallets      INTEGER     NOT NULL DEFAULT 3,
  max_pro_wallets       INTEGER     NOT NULL DEFAULT 20,
  feature_flags         JSONB       NOT NULL DEFAULT '{}',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed singleton row
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_public_read" ON platform_settings FOR SELECT USING (true);
CREATE POLICY "platform_settings_service_write" ON platform_settings
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================
-- 34. REVENUE RECORDS
-- =============================================================
CREATE TABLE IF NOT EXISTS revenue_records (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_usd    NUMERIC     NOT NULL,
  source        TEXT        NOT NULL,  -- subscription | swap_fee | referral
  plan          TEXT,
  period_start  TIMESTAMPTZ,
  period_end    TIMESTAMPTZ,
  stripe_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_records_ts ON revenue_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_records_source ON revenue_records (source);

-- =============================================================
-- 35. FEE REVENUE
-- =============================================================
CREATE TABLE IF NOT EXISTS fee_revenue (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash       TEXT        NOT NULL UNIQUE,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  fee_amount    NUMERIC     NOT NULL,
  fee_token     TEXT        NOT NULL DEFAULT 'SOL',
  usd_value     NUMERIC,
  chain         TEXT        NOT NULL DEFAULT 'solana',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_revenue_ts ON fee_revenue (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_revenue_user ON fee_revenue (user_id);

-- =============================================================
-- updated_at auto-refresh helper
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','users','wallet_clusters','research_posts','notification_settings','platform_settings'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t
    );
  END LOOP;
END;
$$;

-- =============================================================
-- Supabase Storage bucket (must be run via Dashboard or service role)
-- CREATE BUCKET research-images IF NOT EXISTS (public: true)
-- The API auto-creates it on first upload — see /api/admin/research/upload/route.ts
-- =============================================================
