-- Per-user Context Feed alerts. A user subscribes to a slice of the feed
-- (chain + kind + thresholds); the feed-alert-monitor cron matches new events
-- and writes a notifications row (delivered in real time via the existing
-- notifications realtime publication).
create table if not exists public.feed_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  chain text,                       -- null = any chain
  kind text not null default 'any', -- any | new_coin | volume | trending | rug | smart_money
  min_volume_usd numeric,
  min_price_change_pct numeric,
  active boolean not null default true,
  last_token text,                  -- last notified token (dedupe)
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint feed_alerts_kind_chk check (kind in ('any','new_coin','volume','trending','rug','smart_money'))
);
create index if not exists feed_alerts_user_idx on public.feed_alerts(user_id);
create index if not exists feed_alerts_active_idx on public.feed_alerts(active) where active = true;

alter table public.feed_alerts enable row level security;
drop policy if exists feed_alerts_owner on public.feed_alerts;
create policy feed_alerts_owner on public.feed_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
