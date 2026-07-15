-- ============================================================
-- FOMO coins feature: registry, watchlist, trades, thesis
-- Non-custodial. Graduated-DEX coins on solana / ethereum / bsc.
-- Applied to the live project via MCP apply_migration; mirrored here for parity.
-- ============================================================

-- 1) Wallet balance public-by-default (feature launches public; users can hide in settings)
alter table public.profiles alter column show_wallet_balance set default true;
update public.profiles set show_wallet_balance = true where show_wallet_balance = false;
-- Also expose held coins publicly by default, with its own toggle.
alter table public.profiles add column if not exists show_holdings boolean not null default true;

-- 2) Coin registry: cached metadata for discovery, wire/group embeds, logos.
create table if not exists public.coin_registry (
  chain           text        not null,
  token_key       text        not null,
  token_address   text        not null,
  symbol          text,
  name            text,
  logo_url        text,
  decimals        integer,
  verified        boolean     not null default false,
  is_graduated    boolean     not null default true,
  featured        boolean     not null default false,
  hidden          boolean     not null default false,
  price_usd       numeric,
  market_cap_usd  numeric,
  liquidity_usd   numeric,
  volume_24h_usd  numeric,
  change_1h       numeric,
  change_24h      numeric,
  holders_count   integer,
  dex             text,
  pair_address    text,
  socials         jsonb       not null default '{}'::jsonb,
  first_seen_at   timestamptz not null default now(),
  refreshed_at    timestamptz not null default now(),
  primary key (chain, token_key)
);
create index if not exists coin_registry_mcap_idx     on public.coin_registry (market_cap_usd desc nulls last) where hidden = false;
create index if not exists coin_registry_vol_idx      on public.coin_registry (volume_24h_usd desc nulls last) where hidden = false;
create index if not exists coin_registry_featured_idx on public.coin_registry (featured) where featured = true and hidden = false;
create index if not exists coin_registry_symbol_idx   on public.coin_registry (lower(symbol));

-- 3) Watchlist / favorites (the star on the coin page).
create table if not exists public.coin_watchlist (
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  chain         text        not null,
  token_key     text        not null,
  token_address text        not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, chain, token_key)
);
create index if not exists coin_watchlist_user_idx on public.coin_watchlist (user_id, created_at desc);

-- 4) Platform trade feed: powers the coin "Feed" tab, holder avg-hold, and PnL.
create table if not exists public.coin_trades (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  chain          text        not null,
  token_key      text        not null,
  token_address  text        not null,
  symbol         text,
  side           text        not null check (side in ('buy','sell')),
  usd_amount     numeric     not null default 0,
  token_amount   numeric     not null default 0,
  price_usd      numeric,
  market_cap_usd numeric,
  tx_hash        text,
  status         text        not null default 'confirmed',
  created_at     timestamptz not null default now()
);
create index if not exists coin_trades_coin_idx on public.coin_trades (chain, token_key, created_at desc);
create index if not exists coin_trades_user_idx on public.coin_trades (user_id, created_at desc);
create index if not exists coin_trades_user_coin_idx on public.coin_trades (user_id, chain, token_key, created_at);

-- 5) Thesis: a note a holder attaches to a coin (shows in Holders + Feed "Thesis only").
create table if not exists public.coin_thesis (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  chain         text        not null,
  token_key     text        not null,
  token_address text        not null,
  body          text        not null,
  wire_post_id  uuid        references public.wire_posts(id) on delete set null,
  like_count    integer     not null default 0,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists coin_thesis_coin_idx on public.coin_thesis (chain, token_key, created_at desc) where deleted_at is null;
create index if not exists coin_thesis_user_idx on public.coin_thesis (user_id, created_at desc);

create table if not exists public.coin_thesis_likes (
  thesis_id  uuid        not null references public.coin_thesis(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thesis_id, user_id)
);

-- ============================================================
-- RLS: public reads for discovery/social; writes are owner-scoped.
-- ============================================================
alter table public.coin_registry     enable row level security;
alter table public.coin_watchlist    enable row level security;
alter table public.coin_trades       enable row level security;
alter table public.coin_thesis       enable row level security;
alter table public.coin_thesis_likes enable row level security;

drop policy if exists coin_registry_read on public.coin_registry;
create policy coin_registry_read on public.coin_registry for select using (hidden = false);

drop policy if exists coin_watchlist_own on public.coin_watchlist;
create policy coin_watchlist_own on public.coin_watchlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists coin_trades_read on public.coin_trades;
create policy coin_trades_read on public.coin_trades for select using (true);
drop policy if exists coin_trades_insert_own on public.coin_trades;
create policy coin_trades_insert_own on public.coin_trades for insert with check (user_id = auth.uid());

drop policy if exists coin_thesis_read on public.coin_thesis;
create policy coin_thesis_read on public.coin_thesis for select using (deleted_at is null);
drop policy if exists coin_thesis_write_own on public.coin_thesis;
create policy coin_thesis_write_own on public.coin_thesis for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists coin_thesis_likes_own on public.coin_thesis_likes;
create policy coin_thesis_likes_own on public.coin_thesis_likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
