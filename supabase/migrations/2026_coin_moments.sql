-- Coin moments: auto-detected highlight events on the Coins surface.
-- A moment is a REAL detected event (a market-cap milestone crossing, a burst
-- of circle buying, a volume spike), never a fabricated post. The cron writes
-- rows here; the Wire and the coins home read them back. Real data only.

create table if not exists public.coin_moments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('mcap_milestone', 'circle_buying', 'volume_spike')),
  chain text not null,
  token_key text not null,
  token_address text not null,
  symbol text,
  headline text not null,
  detail text,
  market_cap_usd numeric,
  actor_user_ids uuid[] default '{}',
  created_at timestamptz not null default now(),
  -- Dedupe key: a given milestone / burst headline fires exactly once.
  unique (kind, chain, token_key, headline)
);

create index if not exists coin_moments_created_at_idx
  on public.coin_moments (created_at desc);
create index if not exists coin_moments_chain_token_idx
  on public.coin_moments (chain, token_key);

alter table public.coin_moments enable row level security;

-- Moments are public read; writes are server-only (service role bypasses RLS,
-- and no policy grants insert/update/delete to anon or authenticated).
drop policy if exists coin_moments_public_select on public.coin_moments;
create policy coin_moments_public_select
  on public.coin_moments
  for select
  using (true);
