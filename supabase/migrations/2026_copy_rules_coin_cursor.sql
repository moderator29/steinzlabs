-- Per-rule cursor for coin copy-trading: the timestamp up to which the leader's
-- coin_trades buys have already been mirrored to the follower. Only used by
-- coin-scoped rules (leader_user_id is not null); whale rules ignore it.
alter table public.user_copy_rules
  add column if not exists coin_last_seen_at timestamptz not null default now();
