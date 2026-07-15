-- Coins feature: post-audit hardening. Applied via MCP; mirrored here for parity.

-- Restrict direct reads of coin_trades to the owner. Public coin feeds and
-- holders are served through the service-role server routes, so this does not
-- break the product; it stops the anon key from dumping everyone's raw trades.
drop policy if exists coin_trades_read on public.coin_trades;
create policy coin_trades_read_own on public.coin_trades for select using (user_id = auth.uid());

-- Block replay and duplicate trade records: a settled tx can be recorded once.
create unique index if not exists coin_trades_txhash_uniq
  on public.coin_trades (chain, tx_hash) where tx_hash is not null;

-- Per-viewer-per-day dedup so profile views cannot be inflated by refreshing.
create table if not exists public.profile_view_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id  uuid not null,
  day        date not null,
  primary key (profile_id, viewer_id, day)
);
alter table public.profile_view_log enable row level security;
