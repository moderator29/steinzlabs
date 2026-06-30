-- #68 Market-Maker bot — non-custodial automated liquidity/spread strategies.
-- Execution reuses the AA session-key path (kernel account funded with the MM
-- budget); the engine cron places capped swaps. No mock data; PnL from real fills.

create table if not exists mm_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null,
  token_address text not null,
  token_symbol text,
  quote_token_address text,                 -- USDC/SOL the strategy quotes against
  strategy_type text not null default 'grid' check (strategy_type in ('grid','range','presence')),
  reference_price_mode text not null default 'market' check (reference_price_mode in ('market','manual')),
  manual_reference_price numeric,
  spread_bps integer not null default 100,  -- half-spread per side
  num_levels integer not null default 3,
  order_size_usd numeric not null,
  budget_usd numeric not null,
  max_inventory_usd numeric,
  max_slippage_bps integer not null default 200,
  band_pct numeric default 10,              -- grid: +/- band around reference
  range_lower_pct numeric,                  -- range strategy bounds
  range_upper_pct numeric,
  wallet_source text not null default 'builtin',
  kernel_address text,
  status text not null default 'paused' check (status in ('active','paused','stopped')),
  realized_pnl_usd numeric not null default 0,
  inventory_tokens numeric not null default 0,
  spent_usd numeric not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mm_orders (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references mm_strategies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null,
  side text not null check (side in ('buy','sell')),
  target_price numeric not null,
  size_usd numeric not null,
  status text not null default 'open' check (status in ('open','filled','cancelled','failed')),
  tx_hash text,
  filled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists mm_fills (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references mm_strategies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null check (side in ('buy','sell')),
  price numeric,
  amount_usd numeric,
  amount_tokens numeric,
  fee_usd numeric,
  pnl_usd numeric,
  tx_hash text,
  created_at timestamptz not null default now()
);

create index if not exists mm_strategies_user_idx on mm_strategies (user_id);
create index if not exists mm_strategies_active_idx on mm_strategies (status) where status = 'active';
create index if not exists mm_orders_strategy_idx on mm_orders (strategy_id);
create index if not exists mm_fills_strategy_idx on mm_fills (strategy_id);

alter table mm_strategies enable row level security;
alter table mm_orders enable row level security;
alter table mm_fills enable row level security;

-- Owners read/write their own strategies; orders+fills are read-only to owners
-- (the engine writes them via the service role, which bypasses RLS).
drop policy if exists mm_strategies_owner on mm_strategies;
create policy mm_strategies_owner on mm_strategies for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists mm_orders_owner_read on mm_orders;
create policy mm_orders_owner_read on mm_orders for select to authenticated using (user_id = auth.uid());
drop policy if exists mm_fills_owner_read on mm_fills;
create policy mm_fills_owner_read on mm_fills for select to authenticated using (user_id = auth.uid());
