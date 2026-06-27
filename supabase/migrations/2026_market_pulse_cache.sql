-- Singleton cache for the AI Market Pulse so it is generated at most a few
-- times per day across all serverless instances (caps Anthropic spend).
create table if not exists public.market_pulse (
  id smallint primary key default 1,
  pulse text not null,
  tone text not null default 'mixed',
  updated_at timestamptz not null default now(),
  constraint market_pulse_singleton check (id = 1)
);
alter table public.market_pulse enable row level security;
drop policy if exists market_pulse_read on public.market_pulse;
create policy market_pulse_read on public.market_pulse for select using (true);
