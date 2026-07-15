-- Coin price / market-cap alert bells for the Coins feature.
-- A user arms an alert on a specific coin; the coin-alerts cron compares the
-- live price / market cap to the threshold and, on a hit, sends a notification,
-- stamps triggered_at, and deactivates the row. Owner-only RLS. Writes go
-- through getSupabaseAdmin with an explicit user_id binding in the API route.
create table if not exists public.coin_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  chain         text not null,
  token_key     text not null,
  token_address text not null,
  kind          text not null check (kind in ('price_above', 'price_below', 'mcap_above', 'mcap_below')),
  threshold     numeric not null,
  active         boolean not null default true,
  created_at    timestamptz not null default now(),
  triggered_at  timestamptz
);

-- GET my alerts for a coin: user_id + coin lookup.
create index if not exists coin_alerts_user_idx on public.coin_alerts (user_id);
create index if not exists coin_alerts_coin_idx on public.coin_alerts (chain, token_key);
-- Cron scan: only the still-armed rows.
create index if not exists coin_alerts_active_idx on public.coin_alerts (active) where active = true;

alter table public.coin_alerts enable row level security;

drop policy if exists coin_alerts_owner on public.coin_alerts;
create policy coin_alerts_owner on public.coin_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
