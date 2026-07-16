-- Referral fee-share: refer a friend, earn a share of the platform fee their
-- trading generates. Two tables:
--   referral_codes  makes a deterministic per-user code reversible (code -> referrer)
--   referrals       records who referred whom (a user can be referred once, ever)

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  check (referrer_id <> referee_id)
);

create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

-- referral_codes: codes are public so a share link resolves to its referrer.
drop policy if exists referral_codes_select on public.referral_codes;
create policy referral_codes_select on public.referral_codes
  for select using (true);

-- Writes go through getSupabaseAdmin (service role bypasses RLS); this INSERT
-- check only matters for the anon/authenticated path and keeps a user from
-- claiming someone else's code row.
drop policy if exists referral_codes_insert on public.referral_codes;
create policy referral_codes_insert on public.referral_codes
  for insert with check (auth.uid() = user_id);

-- referrals: a user can read rows where they are either side of the referral.
drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referee_id);

-- Only the referee themselves can create their own referral row.
drop policy if exists referrals_insert on public.referrals;
create policy referrals_insert on public.referrals
  for insert with check (auth.uid() = referee_id);
