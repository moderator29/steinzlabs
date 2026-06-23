-- §B5 — persist Context Feed events so the live feed and (especially) the
-- 24–72h archive are deterministic across serverless instances. The route's
-- in-memory eventStore was per-lambda, so the archive showed a random subset.
-- Written + read via service_role (getSupabaseAdmin), which bypasses RLS.
create table if not exists public.context_feed_events (
  id          text primary key,
  chain       text not null,
  type        text,
  event_ts    timestamptz,
  fetched_at  timestamptz not null default now(),
  payload     jsonb not null
);

create index if not exists context_feed_events_fetched_at_idx
  on public.context_feed_events (fetched_at desc);
create index if not exists context_feed_events_chain_fetched_idx
  on public.context_feed_events (chain, fetched_at desc);

-- Server-only table: writes/reads go through service_role, which bypasses RLS.
-- Enable RLS with no anon/auth policies so it is not directly client-readable.
alter table public.context_feed_events enable row level security;
