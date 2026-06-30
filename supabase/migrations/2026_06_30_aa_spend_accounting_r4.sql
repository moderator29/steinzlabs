-- Round-4 audit fixes for the AA daily-spend accounting.

-- FINDING 1 (CRITICAL): aa_daily_spend_usd counted sniper_executions rows the
-- instant they were STAGED. sniper-auto-execute inserts the execution row with
-- status='pending' + buy_amount_usd set + executed_at defaulting to now(),
-- BEFORE the buy is broadcast. The old sum filtered only on executed_at +
-- buy_amount_usd, never on status — so:
--   (a) a snipe double-counted itself: its own freshly-staged pending row was
--       read as v_spent inside the reservation check, on top of the reservation,
--       consuming ~2x its notional against the cap; and
--   (b) a snipe that fell back to the one-tap pending_trades path (or never
--       executed at all) still counted as AA spend for a full 24h.
-- Count only rows that represent a REAL executed buy: status='confirmed' AND
-- tx_hash set. Both execution paths (AA fast-path and pending_trades confirm)
-- write exactly that on success. mm_fills already only exist post-fill, so the
-- MM side is unchanged.
create or replace function aa_daily_spend_usd(p_user uuid, p_chain text, p_since timestamptz)
returns numeric
language sql
stable
as $$
  select
    coalesce((
      select sum(buy_amount_usd) from sniper_executions
      where user_id = p_user and chain = p_chain
        and status = 'confirmed' and tx_hash is not null
        and executed_at >= p_since and buy_amount_usd is not null
    ), 0)
    +
    coalesce((
      select sum(f.amount_usd) from mm_fills f
      join mm_strategies s on s.id = f.strategy_id
      where s.user_id = p_user and s.chain = p_chain and f.side = 'buy' and f.created_at >= p_since
    ), 0);
$$;

-- FINDING 2b (HIGH): the reservation TTL (was 120s) could lapse before a slow
-- swap's spend was recorded, reopening the cross-cron over-spend window. The
-- recording happens immediately after the on-chain confirmation returns, and a
-- money cron is bounded by maxDuration=300s — so a TTL of 300s guarantees the
-- reservation outlives the entire tick that created it. By the time it could
-- expire, that tick has already recorded the confirmed spend or released the
-- reservation on failure. A succeeded trade then briefly double-counts
-- (reservation + confirmed row) which only UNDER-spends the cap; never over.
create or replace function public.aa_reserve_daily_spend(
  p_user uuid,
  p_chain text,
  p_amount numeric,
  p_cap numeric,
  p_since timestamptz,
  p_ttl_seconds int default 300
)
returns uuid
language plpgsql
as $$
declare
  v_spent numeric;
  v_reserved numeric;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_chain, 0));

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

-- FINDING 4 (MED): lock the reservation functions to the service role. They are
-- only ever called by the engine (service role), and CLAUDE.md forbids leaving
-- RLS-bypassing/accounting surfaces callable by anon/authenticated. RLS already
-- denies clients the underlying table writes, but revoke EXECUTE for defense in
-- depth + to stop authenticated users probing other users' spend state.
revoke execute on function public.aa_reserve_daily_spend(uuid, text, numeric, numeric, timestamptz, int) from public, anon, authenticated;
revoke execute on function public.aa_release_reservation(uuid) from public, anon, authenticated;
revoke execute on function public.aa_active_reserved_usd(uuid, text) from public, anon, authenticated;
grant execute on function public.aa_reserve_daily_spend(uuid, text, numeric, numeric, timestamptz, int) to service_role;
grant execute on function public.aa_release_reservation(uuid) to service_role;
grant execute on function public.aa_active_reserved_usd(uuid, text) to service_role;
