-- DM flow + notifications hardening (messaging audit #69).

-- DM: atomic last_message_at + inbox preview via trigger (no app-layer second write).
alter table public.dm_conversations
  add column if not exists last_message_preview text,
  add column if not exists last_message_sender uuid references public.profiles(id) on delete set null,
  add column if not exists is_encrypted boolean not null default false;

-- Backfill the encryption flag from the existing sentinel.
update public.dm_conversations
  set is_encrypted = (conversation_key_a is distinct from 'plain')
  where is_encrypted = false;

create or replace function public.dm_bump_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_conversations
     set last_message_at = new.created_at,
         last_message_sender = new.sender_id,
         -- Only previewable when stored plaintext (iv=''); for true E2E the
         -- client decrypts the latest message itself, so leave it null.
         last_message_preview = case when new.iv = '' and new.message_type = 'text'
                                     then left(new.encrypted_content, 140) else null end
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_dm_bump_last on public.dm_messages;
create trigger trg_dm_bump_last after insert on public.dm_messages
  for each row execute function public.dm_bump_last_message();

-- DM: idempotency for retried sends (double-tap / flaky mobile).
alter table public.dm_messages add column if not exists client_msg_id uuid;
create unique index if not exists dm_messages_client_dedupe
  on public.dm_messages (conversation_id, sender_id, client_msg_id)
  where client_msg_id is not null;

-- DM: partial index backing the unread-count query.
create index if not exists idx_dm_msg_unread
  on public.dm_messages (conversation_id)
  where read_at is null and deleted_at is null;

-- Notifications: feed query index + soft dedup support.
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_dedup
  on public.notifications (user_id, type, ((metadata->>'dedup_key')))
  where metadata ? 'dedup_key';

-- Notifications: one-round-trip, RLS-safe mark-all-read.
create or replace function public.mark_all_notifications_read()
returns void
language sql
security invoker
as $$
  update public.notifications set read = true
  where user_id = auth.uid() and read = false;
$$;
