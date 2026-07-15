-- Coin room presence: real "N watching" for a per-coin live chat. Each row is a
-- user's most recent heartbeat in a room keyed by (chain, token_key). The room
-- header counts distinct users whose last_seen_at is within the last 60s, so a
-- watcher who closed the room drops out of the count as their heartbeat goes
-- stale. Counts are public to read; a user only writes or clears their own row.
-- Writes go through the admin client with an explicit user_id binding in the
-- route, so the RLS INSERT/UPDATE/DELETE checks stay honest.

create table if not exists public.coin_room_presence (
  chain text not null,
  token_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (chain, token_key, user_id)
);

create index if not exists coin_room_presence_room_idx
  on public.coin_room_presence (chain, token_key, last_seen_at);

alter table public.coin_room_presence enable row level security;

-- Presence counts are public.
drop policy if exists coin_room_presence_select on public.coin_room_presence;
create policy coin_room_presence_select
  on public.coin_room_presence for select
  using (true);

-- A user may only record a heartbeat as themselves.
drop policy if exists coin_room_presence_insert on public.coin_room_presence;
create policy coin_room_presence_insert
  on public.coin_room_presence for insert
  with check (auth.uid() = user_id);

drop policy if exists coin_room_presence_update on public.coin_room_presence;
create policy coin_room_presence_update
  on public.coin_room_presence for update
  with check (auth.uid() = user_id);

-- A user may only clear their own presence.
drop policy if exists coin_room_presence_delete on public.coin_room_presence;
create policy coin_room_presence_delete
  on public.coin_room_presence for delete
  using (auth.uid() = user_id);
