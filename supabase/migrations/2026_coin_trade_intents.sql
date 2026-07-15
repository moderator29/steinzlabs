-- Armed "limit buy" intents for the Coins feature.
-- Non-custodial: an intent never executes on its own. A user arms a buy intent
-- on a specific coin; the coin-intent-monitor cron compares the live price /
-- market cap to the threshold and, on a hit, sends a notification pinging the
-- user to sign the buy in one tap, then stamps triggered_at and deactivates the
-- row. Their funds never move without them. amount_usd is the USD to spend when
-- the trigger hits (matches the coin page's USD-denominated buy). Owner-only
-- RLS. Writes go through getSupabaseAdmin with an explicit user_id binding in
-- the API route.
create table if not exists public.coin_trade_intents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  chain         text not null,
  token_key     text not null,
  token_address text not null,
  symbol        text,
  trigger_kind  text not null check (trigger_kind in ('price_below', 'price_above', 'mcap_below', 'mcap_above')),
  threshold     numeric not null,
  amount_usd    numeric not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  triggered_at  timestamptz
);

-- GET my intents for a coin: user_id + coin lookup.
create index if not exists coin_trade_intents_user_idx on public.coin_trade_intents (user_id);
create index if not exists coin_trade_intents_coin_idx on public.coin_trade_intents (chain, token_key);
-- Cron scan: only the still-armed rows.
create index if not exists coin_trade_intents_active_idx on public.coin_trade_intents (active) where active = true;

alter table public.coin_trade_intents enable row level security;

drop policy if exists coin_trade_intents_owner on public.coin_trade_intents;
create policy coin_trade_intents_owner on public.coin_trade_intents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
