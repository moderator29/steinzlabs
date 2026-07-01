-- Public, address-keyed snapshot of the shareable wallet health score.
--
-- Unlike user_security_profile (per authenticated user), this record is keyed
-- by (address, chain) so ANY looked-up wallet's most-recent computed score has
-- a durable, cross-instance record backing shared cards. All values are derived
-- in code from real signals (open approvals, GoPlus honeypot exposure, OFAC,
-- age/activity) — see lib/security/walletHealth.ts. No user PII lives here.
--
-- Idempotent: safe to re-run.

create table if not exists public.wallet_health_scores (
  address     text        not null,
  chain       text        not null default 'ethereum',
  score       smallint    not null check (score between 0 and 100),
  band        text        not null,
  coverage    numeric(4,2) not null default 0,
  components  jsonb       not null default '{}'::jsonb,
  signals     jsonb       not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (address, chain)
);

create index if not exists wallet_health_scores_computed_idx
  on public.wallet_health_scores (computed_at desc);

-- Row Level Security: reads are public (these scores are shareable and contain
-- no PII); writes go through the service role only (the API route computes and
-- upserts). No anon/authenticated write policy is defined, so RLS denies client
-- writes by default while the service_role key bypasses RLS for the upsert.
alter table public.wallet_health_scores enable row level security;

drop policy if exists wallet_health_scores_public_read on public.wallet_health_scores;
create policy wallet_health_scores_public_read
  on public.wallet_health_scores
  for select
  using (true);
