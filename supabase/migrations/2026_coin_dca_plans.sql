-- One-tap DCA plans for the Coins feature.
-- Non-custodial: no session key exists, so a recurring buy CANNOT auto-sign. A
-- DCA plan is a scheduled reminder, not custodial execution. On each due date
-- the coin-dca cron notifies the user with a one-tap prefilled buy deep link;
-- the user signs each buy themselves. Their funds never move without them.
--
-- usd_per_buy is the USD to spend per reminder (matches the coin page's
-- USD-denominated buy). interval_hours is the cadence between reminders (24 =
-- daily). remaining_count counts down the reminders left; when it hits 0 the
-- plan deactivates. next_run_at is the next due timestamp; the cron fires
-- whatever is due (finest useful dispatch interval is hourly). Owner-only RLS.
-- Writes go through getSupabaseAdmin with an explicit user_id binding in the
-- API route.
create table if not exists public.coin_dca_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  chain           text not null,
  token_key       text not null,
  token_address   text not null,
  symbol          text,
  usd_per_buy     numeric not null,
  interval_hours  integer not null default 24,
  remaining_count integer not null,
  next_run_at     timestamptz not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- GET my plans for a coin: user_id scoped.
create index if not exists coin_dca_plans_user_idx on public.coin_dca_plans (user_id);
-- Cron scan: only the still-active plans.
create index if not exists coin_dca_plans_active_idx on public.coin_dca_plans (next_run_at) where active = true;

alter table public.coin_dca_plans enable row level security;

drop policy if exists coin_dca_plans_owner on public.coin_dca_plans;
create policy coin_dca_plans_owner on public.coin_dca_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
