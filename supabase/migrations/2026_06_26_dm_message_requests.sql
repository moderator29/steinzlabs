-- X/Instagram-style message requests on existing dm_conversations.
-- Additive + backward-compatible: all existing conversations default to
-- 'accepted' so current inboxes are unaffected. A DM from a non-mutual lands
-- as 'pending' (requested_by = sender) in the recipient's Requests tab until
-- they accept; mutual / already-following conversations are created 'accepted'.
alter table public.dm_conversations
  add column if not exists request_state text not null default 'accepted',
  add column if not exists requested_by uuid references public.profiles(id) on delete set null;

alter table public.dm_conversations
  drop constraint if exists dm_conversations_request_state_check;
alter table public.dm_conversations
  add constraint dm_conversations_request_state_check
  check (request_state in ('pending','accepted','declined'));

-- Fast lookup of a user's pending requests.
create index if not exists dm_conversations_request_idx
  on public.dm_conversations (request_state, requested_by);
