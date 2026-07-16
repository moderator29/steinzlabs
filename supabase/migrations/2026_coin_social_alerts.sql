-- Social buy alerts for a coin: notify an owner when someone they follow, or
-- any Proven trader, records a BUY on a specific coin. Owner-scoped rows, one
-- per (user, coin, scope). The coin-social-buy-monitor cron reads active rows,
-- checks each cohort for new BUY trades since last_seen_at, notifies, then
-- bumps last_seen_at. Real data only: an alert never fires without a real trade.

create table if not exists public.coin_social_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null,
  token_key text not null,
  token_address text not null,
  symbol text,
  scope text not null check (scope in ('following', 'proven')),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, chain, token_key, scope)
);

create index if not exists coin_social_alerts_user_idx
  on public.coin_social_alerts (user_id);

create index if not exists coin_social_alerts_coin_idx
  on public.coin_social_alerts (chain, token_key);

create index if not exists coin_social_alerts_active_idx
  on public.coin_social_alerts (chain, token_key)
  where active;

alter table public.coin_social_alerts enable row level security;

drop policy if exists coin_social_alerts_owner_select on public.coin_social_alerts;
create policy coin_social_alerts_owner_select on public.coin_social_alerts
  for select using (auth.uid() = user_id);

drop policy if exists coin_social_alerts_owner_insert on public.coin_social_alerts;
create policy coin_social_alerts_owner_insert on public.coin_social_alerts
  for insert with check (auth.uid() = user_id);

drop policy if exists coin_social_alerts_owner_update on public.coin_social_alerts;
create policy coin_social_alerts_owner_update on public.coin_social_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists coin_social_alerts_owner_delete on public.coin_social_alerts;
create policy coin_social_alerts_owner_delete on public.coin_social_alerts
  for delete using (auth.uid() = user_id);
