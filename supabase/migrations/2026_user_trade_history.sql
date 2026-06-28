-- Unified per-account trade ledger.
--
-- Every trade surface (swap card, market terminal, View Proof, VTX, sniper,
-- wallet send) writes here so the Naka wallet Activity tab can show ALL
-- app-initiated trades — not just on-chain-decoded transfers. Activity merges
-- this ledger with the on-chain decode (UNION, deduped by tx_hash).
--
-- Additive only: swap_logs / sniper_executions / transaction_history are
-- unchanged. Rows here may have a null user_id (unattributable) but always
-- carry wallet_address, which is how Activity looks them up.
create table if not exists public.user_trade_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  wallet_address text not null,
  chain text not null,
  trade_type text not null default 'swap',  -- swap | buy | sell | send | snipe | receive
  source text,                               -- swap-page | market | vtx | proof | wallet-send | sniper
  tx_hash text,
  token_in text,
  token_out text,
  amount_in numeric,
  amount_out numeric,
  value_usd numeric,
  status text not null default 'confirmed',  -- pending | confirmed | failed
  created_at timestamptz not null default now()
);

-- Activity reads by wallet+chain, newest first.
create index if not exists user_trade_history_wallet_idx
  on public.user_trade_history (lower(wallet_address), chain, created_at desc);
create index if not exists user_trade_history_user_idx
  on public.user_trade_history (user_id, created_at desc);
-- De-dupe guard: one row per (tx_hash, chain) when a hash exists.
create unique index if not exists user_trade_history_txhash_uniq
  on public.user_trade_history (tx_hash, chain) where tx_hash is not null;

alter table public.user_trade_history enable row level security;
-- Owners can read their own rows directly from the client. Writes go through
-- the service role (server), which bypasses RLS.
drop policy if exists user_trade_history_owner on public.user_trade_history;
create policy user_trade_history_owner on public.user_trade_history
  for select using (auth.uid() = user_id);
