-- Market-maker audit fixes (#68).

-- C1/C2/H4: real cost-basis + a monotonic lifetime spend cap (budget must NOT
-- be credited back on sells). gross_deployed_usd only ever increases on buys;
-- inventory_cost_usd tracks the cost basis of held inventory for true net PnL.
alter table mm_strategies
  add column if not exists gross_deployed_usd numeric not null default 0,
  add column if not exists inventory_cost_usd numeric not null default 0;

-- C3: unified AA daily spend across BOTH the sniper and the market maker, so the
-- owner-signed daily_cap_usd actually bounds the bot. Sums sniper_executions buys
-- + mm_fills buys (joined to the strategy's chain) over the window.
create or replace function aa_daily_spend_usd(p_user uuid, p_chain text, p_since timestamptz)
returns numeric
language sql
stable
as $$
  select
    coalesce((
      select sum(buy_amount_usd) from sniper_executions
      where user_id = p_user and chain = p_chain and executed_at >= p_since and buy_amount_usd is not null
    ), 0)
    +
    coalesce((
      select sum(f.amount_usd) from mm_fills f
      join mm_strategies s on s.id = f.strategy_id
      where s.user_id = p_user and s.chain = p_chain and f.side = 'buy' and f.created_at >= p_since
    ), 0);
$$;

-- L2: accounting columns are engine-managed. Block authenticated clients from
-- writing them directly (a user could otherwise reset spent_usd to reopen budget
-- or fake realized_pnl). Service role (the engine) bypasses the guard.
create or replace function lock_mm_accounting()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.spent_usd is distinct from old.spent_usd
       or new.gross_deployed_usd is distinct from old.gross_deployed_usd
       or new.inventory_cost_usd is distinct from old.inventory_cost_usd
       or new.inventory_tokens is distinct from old.inventory_tokens
       or new.realized_pnl_usd is distinct from old.realized_pnl_usd then
      raise exception 'market-maker accounting columns are engine-managed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_mm_accounting on mm_strategies;
create trigger trg_lock_mm_accounting
  before update on mm_strategies
  for each row execute function lock_mm_accounting();
