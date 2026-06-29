-- #61: backend-ingested real-time new-token firehose. A cron polls every
-- chain + launchpad into this table; the UI reads from it (fast, paginated,
-- hundreds of coins, real filters, realtime) instead of hitting rate-limited
-- provider APIs per request. No mock data ever lands here — only normalized
-- rows from real providers.
create table if not exists sniper_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  token_address text not null,
  pair_address text,
  symbol text,
  name text,
  logo_url text,
  launchpad text,                 -- pumpfun / letsbonk / raydium / meteora / moonshot / believe / bags / heaven / dbc / pumpswap / jupstudio / uniswap / aerodrome ...
  dex text,
  price_usd numeric,
  market_cap_usd numeric,
  fdv_usd numeric,
  liquidity_usd numeric,
  volume_24h_usd numeric,
  txns_24h integer,
  price_change_24h numeric,
  holders integer,
  bonding_curve_pct numeric,      -- 0..100 graduation progress (launchpad coins)
  socials jsonb,                  -- { twitter, telegram, website }
  is_honeypot boolean,
  buy_tax numeric,
  sell_tax numeric,
  security_score integer,         -- 0..100 from GoPlus (null until audited)
  dev_holding_pct numeric,
  dev_sold_all boolean,
  has_social boolean,
  pool_created_at timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain, token_address)
);

create index if not exists sniper_feed_chain_idx on sniper_feed_tokens (chain);
create index if not exists sniper_feed_launchpad_idx on sniper_feed_tokens (launchpad);
create index if not exists sniper_feed_created_idx on sniper_feed_tokens (pool_created_at desc nulls last);
create index if not exists sniper_feed_seen_idx on sniper_feed_tokens (first_seen_at desc);
create index if not exists sniper_feed_vol_idx on sniper_feed_tokens (volume_24h_usd desc nulls last);
create index if not exists sniper_feed_liq_idx on sniper_feed_tokens (liquidity_usd desc nulls last);

alter table sniper_feed_tokens enable row level security;

-- Authenticated users can read the feed; writes happen only via the service
-- role (the ingestion cron), which bypasses RLS.
drop policy if exists sniper_feed_read on sniper_feed_tokens;
create policy sniper_feed_read on sniper_feed_tokens for select to authenticated using (true);
