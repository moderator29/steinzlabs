-- Whale Tracker revival: realtime delivery + alert dispatcher watermark.
--
-- 1. whale_activity was never added to the supabase_realtime publication, so the
--    whale-tracker page's postgres_changes INSERT subscription never fired —
--    "N new whales" never appeared and the feed only updated on the 30s poll.
--    Adding it here makes new ingested rows stream to the browser sub-second.
--    (whale_activity already has an `authenticated` SELECT-true RLS policy, so
--    realtime authorization will deliver INSERTs to logged-in clients.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whale_activity'
  ) then
    execute 'alter publication supabase_realtime add table public.whale_activity';
  end if;
end $$;

-- 2. Per-follow watermark for the whale alert dispatcher. The dispatcher only
--    notifies on whale_activity rows newer than this stamp, so a user is never
--    re-pinged for a move they've already been alerted about.
alter table public.user_whale_follows
  add column if not exists last_alerted_at timestamptz;

-- Index the dispatcher's hot path: "recent priced activity for this whale".
create index if not exists idx_whale_activity_addr_chain_ts
  on public.whale_activity (whale_address, chain, timestamp desc);
