-- Coin rooms: per-coin live chat. A room is keyed by (chain, token_key) and
-- holds real user messages. Rooms are public to read; only the author writes or
-- removes their own message. Writes go through the admin client with an explicit
-- user_id binding in the route, so RLS INSERT/DELETE checks stay honest.

create table if not exists public.coin_room_messages (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  token_key text not null,
  token_address text not null,
  symbol text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists coin_room_messages_room_idx
  on public.coin_room_messages (chain, token_key, created_at desc);
create index if not exists coin_room_messages_user_idx
  on public.coin_room_messages (user_id);

alter table public.coin_room_messages enable row level security;

-- Rooms are public to read.
drop policy if exists coin_room_messages_select on public.coin_room_messages;
create policy coin_room_messages_select
  on public.coin_room_messages for select
  using (true);

-- Only the author may post as themselves.
drop policy if exists coin_room_messages_insert on public.coin_room_messages;
create policy coin_room_messages_insert
  on public.coin_room_messages for insert
  with check (auth.uid() = user_id);

-- Only the author may remove their own message.
drop policy if exists coin_room_messages_delete on public.coin_room_messages;
create policy coin_room_messages_delete
  on public.coin_room_messages for delete
  using (auth.uid() = user_id);
