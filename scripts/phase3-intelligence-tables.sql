-- Phase 3: Intelligence Feature Tables
-- Push Notifications, Bubble Map, Wallet Clusters, Trends, Smart Money, Whale Tracker

-- ─── Push Subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  device_info text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS push_delivery_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  notification_type text,
  payload jsonb,
  delivered boolean DEFAULT false,
  error text,
  sent_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_delivery_log(user_id, sent_at DESC);

-- ─── Notification Settings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whale_alerts_enabled boolean DEFAULT true,
  whale_min_trade_usd integer DEFAULT 20000,
  whale_buy_alerts boolean DEFAULT true,
  whale_sell_alerts boolean DEFAULT true,
  convergence_alerts_enabled boolean DEFAULT true,
  convergence_min_whales integer DEFAULT 3,
  convergence_window_minutes integer DEFAULT 60,
  smart_money_alerts boolean DEFAULT true,
  smart_money_convergence boolean DEFAULT true,
  price_alerts_enabled boolean DEFAULT true,
  trend_alerts_enabled boolean DEFAULT true,
  quiet_hours_enabled boolean DEFAULT false,
  quiet_hours_start time DEFAULT '23:00',
  quiet_hours_end time DEFAULT '07:00',
  quiet_hours_timezone text DEFAULT 'UTC',
  bypass_quiet_for_convergence boolean DEFAULT true,
  email_backup_enabled boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- ─── Bubble Map ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bubblemap_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address text NOT NULL,
  chain text NOT NULL,
  holder_count integer,
  top10_concentration numeric,
  suspicious_cluster_count integer,
  vtx_risk_score integer,
  vtx_summary text,
  graph_nodes jsonb,
  graph_edges jsonb,
  cluster_data jsonb,
  metadata jsonb,
  computed_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(token_address, chain)
);

CREATE TABLE IF NOT EXISTS bubblemap_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  token_address text NOT NULL,
  chain text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bubblemap_conv ON bubblemap_conversations(user_id, token_address, chain);

CREATE TABLE IF NOT EXISTS bubblemap_suspicious_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_user_id uuid REFERENCES auth.users(id),
  wallet_address text NOT NULL,
  token_address text NOT NULL,
  chain text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ─── Wallet Clusters ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_clusters (
  id text PRIMARY KEY,
  name text NOT NULL,
  wallet_count integer NOT NULL,
  risk_score integer NOT NULL,
  risk_level text NOT NULL,
  connection_types text[] DEFAULT '{}',
  total_value_usd numeric DEFAULT 0,
  funding_source_address text,
  activity_level text DEFAULT 'medium',
  vtx_summary text,
  is_active boolean DEFAULT true,
  first_detected_at timestamptz DEFAULT now(),
  last_updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clusters_risk ON wallet_clusters(risk_score DESC) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS wallet_cluster_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id text REFERENCES wallet_clusters(id),
  wallet_address text NOT NULL,
  entity_label text,
  entity_type text,
  value_usd numeric DEFAULT 0,
  connection_count integer DEFAULT 0,
  joined_cluster_at timestamptz DEFAULT now(),
  UNIQUE(cluster_id, wallet_address)
);
CREATE INDEX IF NOT EXISTS idx_cluster_members_addr ON wallet_cluster_members(wallet_address);

CREATE TABLE IF NOT EXISTS wallet_cluster_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id text REFERENCES wallet_clusters(id),
  wallet_a text NOT NULL,
  wallet_b text NOT NULL,
  connection_type text NOT NULL,
  detected_at timestamptz DEFAULT now(),
  evidence jsonb
);

-- ─── On-Chain Trends ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trend_metrics_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chain text NOT NULL,
  metric_name text NOT NULL,
  current_value numeric,
  change_24h_percent numeric,
  history_7d jsonb,
  history_30d jsonb,
  percentile_30d integer,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chain, metric_name)
);

CREATE TABLE IF NOT EXISTS trend_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  chain text NOT NULL,
  metric_name text NOT NULL,
  direction text NOT NULL,
  threshold_value numeric NOT NULL,
  threshold_type text DEFAULT 'percent',
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz,
  notify_push boolean DEFAULT true,
  notify_email boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trend_alerts_user ON trend_alerts(user_id) WHERE is_active = true;

-- ─── Smart Money ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_money_wallets (
  address text NOT NULL,
  chain text NOT NULL,
  archetype text,
  win_rate numeric NOT NULL DEFAULT 0,
  trade_count_45d integer NOT NULL DEFAULT 0,
  pnl_usd_45d numeric NOT NULL DEFAULT 0,
  pnl_usd_7d numeric,
  avg_hold_time_hours numeric,
  avg_position_usd numeric,
  profit_factor numeric,
  leaderboard_rank integer,
  rank_change_7d integer DEFAULT 0,
  is_active boolean DEFAULT true,
  follower_count integer DEFAULT 0,
  last_trade_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (address, chain)
);
CREATE INDEX IF NOT EXISTS idx_smart_money_rank ON smart_money_wallets(leaderboard_rank) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS smart_money_convergence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address text NOT NULL,
  token_symbol text NOT NULL,
  chain text NOT NULL,
  wallet_count integer NOT NULL,
  wallets text[] NOT NULL,
  total_value_usd numeric,
  detected_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_sm_convergence_active ON smart_money_convergence(detected_at DESC) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS smart_money_follows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  wallet_address text NOT NULL,
  chain text NOT NULL,
  followed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, wallet_address, chain)
);

-- ─── Whale Tracker ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whale_wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  address text NOT NULL,
  chain text NOT NULL,
  display_name text,
  is_featured boolean DEFAULT false,
  featured_by_admin uuid,
  featured_description text,
  win_rate_45d numeric,
  pnl_usd_45d numeric,
  trade_count_7d integer,
  avg_trade_size_usd numeric,
  last_trade_at timestamptz,
  is_active boolean DEFAULT true,
  follower_count integer DEFAULT 0,
  qualification_score numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(address, chain)
);
CREATE INDEX IF NOT EXISTS idx_whale_wallets_chain ON whale_wallets(chain, is_active, pnl_usd_45d DESC);
CREATE INDEX IF NOT EXISTS idx_whale_wallets_featured ON whale_wallets(is_featured) WHERE is_featured = true;

CREATE TABLE IF NOT EXISTS whale_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  whale_id uuid REFERENCES whale_wallets(id),
  min_trade_usd integer,
  alert_on_buys boolean DEFAULT true,
  alert_on_sells boolean DEFAULT true,
  alert_on_large boolean DEFAULT true,
  tracked_since timestamptz DEFAULT now(),
  UNIQUE(user_id, whale_id)
);
CREATE INDEX IF NOT EXISTS idx_whale_tracking_user ON whale_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_whale_tracking_whale ON whale_tracking(whale_id);

CREATE TABLE IF NOT EXISTS whale_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  whale_id uuid REFERENCES whale_wallets(id),
  chain text NOT NULL,
  tx_hash text NOT NULL,
  action text NOT NULL,
  token_address text NOT NULL,
  token_symbol text,
  amount_token numeric,
  amount_usd numeric NOT NULL,
  price_per_token numeric,
  dex_name text,
  security_score integer,
  detected_at timestamptz DEFAULT now(),
  block_timestamp timestamptz,
  UNIQUE(tx_hash)
);
CREATE INDEX IF NOT EXISTS idx_whale_txs_whale ON whale_transactions(whale_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_whale_txs_token ON whale_transactions(token_address, detected_at DESC);

CREATE TABLE IF NOT EXISTS convergence_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address text NOT NULL,
  token_symbol text NOT NULL,
  chain text NOT NULL,
  whale_count integer NOT NULL,
  whale_ids uuid[] NOT NULL,
  total_usd numeric NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  detected_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_convergence_active ON convergence_events(detected_at DESC) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS copy_trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  whale_transaction_id uuid REFERENCES whale_transactions(id),
  whale_id uuid REFERENCES whale_wallets(id),
  token_address text NOT NULL,
  chain text NOT NULL,
  amount_usd numeric NOT NULL,
  swap_log_id uuid,
  status text DEFAULT 'pending',
  executed_at timestamptz,
  pnl_usd numeric,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copy_trades_user ON copy_trades(user_id, created_at DESC);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subs_own ON push_subscriptions;
CREATE POLICY push_subs_own ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_settings_own ON notification_settings;
CREATE POLICY notif_settings_own ON notification_settings FOR ALL USING (auth.uid() = user_id);

ALTER TABLE trend_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trend_alerts_own ON trend_alerts;
CREATE POLICY trend_alerts_own ON trend_alerts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE smart_money_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sm_follows_own ON smart_money_follows;
CREATE POLICY sm_follows_own ON smart_money_follows FOR ALL USING (auth.uid() = user_id);

ALTER TABLE whale_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whale_tracking_own ON whale_tracking;
CREATE POLICY whale_tracking_own ON whale_tracking FOR ALL USING (auth.uid() = user_id);

ALTER TABLE copy_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS copy_trades_own ON copy_trades;
CREATE POLICY copy_trades_own ON copy_trades FOR ALL USING (auth.uid() = user_id);

ALTER TABLE bubblemap_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bubblemap_conv_own ON bubblemap_conversations;
CREATE POLICY bubblemap_conv_own ON bubblemap_conversations FOR ALL USING (auth.uid() = user_id);
