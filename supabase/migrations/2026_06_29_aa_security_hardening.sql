-- Audit #47 hardening for the AA money path.

-- C2: atomic match claim. A claimed_at column lets sniper-auto-execute claim a
-- match row with a conditional UPDATE before broadcasting, so two overlapping
-- cron ticks can't both execute the same buy (double-spend).
alter table sniper_match_events add column if not exists claimed_at timestamptz;

-- C1: cron-level mutual exclusion. supabase-js talks to PostgREST (no persistent
-- session), so pg_advisory_lock is unusable; use a tiny lock table + an atomic
-- acquire function instead. One statement, conflict-safe: insert wins on a fresh
-- name; on conflict the UPDATE only fires when the prior lock has expired.
create table if not exists cron_locks (
  name text primary key,
  locked_until timestamptz not null
);

create or replace function try_acquire_cron_lock(p_name text, p_ttl_seconds int)
returns boolean
language plpgsql
as $$
declare
  acquired boolean;
begin
  insert into cron_locks (name, locked_until)
  values (p_name, now() + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update
    set locked_until = excluded.locked_until
    where cron_locks.locked_until < now()
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

create or replace function release_cron_lock(p_name text)
returns void
language sql
as $$
  update cron_locks set locked_until = now() - interval '1 second' where name = p_name;
$$;

-- H1: stop approve-step signature replay from resurrecting a revoked grant or
-- minting duplicate active grants. Only one active (non-revoked) row may exist
-- per (user, kernel, session) tuple; a replayed approve insert now conflicts.
create unique index if not exists user_session_keys_active_uniq
  on user_session_keys (user_id, kernel_address, session_address)
  where revoked_at is null;
