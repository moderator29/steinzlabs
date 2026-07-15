-- "Copy a trader" (coins): scope a user_copy_rules row to a platform LEADER
-- (a profile) whose coin_trades buys are mirrored, rather than an on-chain
-- whale address. Nullable so every existing whale rule is untouched. A rule
-- with leader_user_id set carries the sentinel whale_address 'coin:<uuid>' and
-- chain 'coins', so the on-chain whale matcher never matches it.
alter table public.user_copy_rules
  add column if not exists leader_user_id uuid references public.profiles(id) on delete cascade;

-- One coin-copy rule per (follower, leader). Whale rules (leader_user_id null)
-- keep their own unique (user_id, whale_address, chain) key untouched.
create unique index if not exists user_copy_rules_user_leader_key
  on public.user_copy_rules (user_id, leader_user_id)
  where leader_user_id is not null;

create index if not exists user_copy_rules_leader_idx
  on public.user_copy_rules (leader_user_id)
  where leader_user_id is not null;
