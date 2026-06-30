-- Round-3 audit fix: atomic AA daily-spend reservation.
--
-- HIGH/MED (cross-cron TOCTOU): the sniper-auto-execute and mm-engine money
-- crons hold SEPARATE cron locks, so they run concurrently. Both called
-- aa_daily_spend_usd, both read the same pre-trade daily total, both passed the
-- daily_cap_usd check, and both spent — busting the owner-signed daily cap.
--
-- Fix: a reservation row counts as in-flight spend the instant it is granted,
-- and the grant runs under a per-(user,chain) transaction advisory lock so the
-- check-and-reserve is atomic across BOTH crons (and any future money path).
-- A short TTL auto-expires reservations whose swap never landed; the executor
-- also explicitly releases a reservation when its swap aborts. The accounting
-- is biased safe: a succeeded trade briefly counts via BOTH its reservation and
-- its recorded fill (until the reservation TTL lapses), which can only
-- UNDER-spend the cap, never over-spend it.

create table if not exists public.aa_spend_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chain text not null,
  amount_usd numeric not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_aa_spend_res_user_chain
  on public.aa_spend_reservations (user_id, chain, expires_at);

-- Service-role only: enable RLS with NO client policy = deny-all to clients
-- (the engine uses the service role, which bypasses RLS). Same pattern as
-- cron_locks / aa_auth_nonces.
alter table public.aa_spend_reservations enable row level security;

-- Sum of un-expired reservations for a user+chain (in-flight, not-yet-recorded
-- spend that aa_daily_spend_usd can't see yet because no fill row exists).
create or replace function public.aa_active_reserved_usd(p_user uuid, p_chain text)
returns numeric
language sql
stable
as $$
  select coalesce(sum(amount_usd), 0)
  from public.aa_spend_reservations
  where user_id = p_user and chain = p_chain and expires_at > now();
$$;

-- Atomic check-and-reserve. Returns the reservation id when granted, or NULL
-- when the new spend (recorded + already-reserved + this trade) would breach the
-- cap. Serialized per (user,chain) by a transaction advisory lock so two
-- concurrent crons can never both pass the same check.
create or replace function public.aa_reserve_daily_spend(
  p_user uuid,
  p_chain text,
  p_amount numeric,
  p_cap numeric,
  p_since timestamptz,
  p_ttl_seconds int default 120
)
returns uuid
language plpgsql
as $$
declare
  v_spent numeric;
  v_reserved numeric;
  v_id uuid;
begin
  -- Serialize the check+insert for this user+chain across all callers; the lock
  -- releases automatically at transaction end.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_chain, 0));

  -- Opportunistic GC of long-dead rows (cheap, runs under the lock).
  delete from public.aa_spend_reservations where expires_at <= now() - interval '1 hour';

  v_spent := public.aa_daily_spend_usd(p_user, p_chain, p_since);
  v_reserved := public.aa_active_reserved_usd(p_user, p_chain);

  if v_spent + v_reserved + p_amount > p_cap then
    return null;
  end if;

  insert into public.aa_spend_reservations (user_id, chain, amount_usd, expires_at)
  values (p_user, p_chain, p_amount, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;

  return v_id;
end;
$$;

-- Release a reservation whose swap aborted/failed so it stops holding budget
-- before its TTL would otherwise expire.
create or replace function public.aa_release_reservation(p_id uuid)
returns void
language sql
as $$
  delete from public.aa_spend_reservations where id = p_id;
$$;
