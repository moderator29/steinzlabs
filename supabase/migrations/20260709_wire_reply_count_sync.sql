-- Keep wire_posts.reply_count honest & atomic (applied live via MCP, mirrored
-- here). A reply is a wire_posts row with reply_to set; this trigger mirrors the
-- existing wire_like_count_sync pattern: increment the parent on insert of a
-- live reply, decrement when a reply is soft-deleted (deleted_at set). Existing
-- drift is backfilled once at apply time.
create or replace function public.wire_reply_count_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.reply_to is not null and new.deleted_at is null then
      update public.wire_posts set reply_count = reply_count + 1 where id = new.reply_to;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.reply_to is not null and old.deleted_at is null and new.deleted_at is not null then
      update public.wire_posts set reply_count = greatest(0, reply_count - 1) where id = new.reply_to;
    end if;
  end if;
  return null;
end
$$;

drop trigger if exists trg_wire_reply_count on public.wire_posts;
create trigger trg_wire_reply_count
after insert or update of deleted_at on public.wire_posts
for each row execute function public.wire_reply_count_sync();
