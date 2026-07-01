-- User-curated "Saved" vault for Context Feed / Archive events. A user clicks
-- Save on a feed or archive card; the full event snapshot is stored as JSONB so
-- the saved item survives even after the source event rolls out of the live
-- 24-72h window. RLS scopes every row to its owner: a user only ever sees,
-- inserts, or deletes their own saved events.
create table if not exists public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Stable identifier of the source event (ContextEvent.id). Used to dedupe a
  -- second Save of the same event and to drive the saved-state toggle.
  event_ref text not null,
  -- Full event snapshot at save time, so the vault renders standalone.
  payload jsonb not null,
  saved_at timestamptz not null default now()
);

-- One row per (user, event): re-saving the same event is a no-op upsert target.
create unique index if not exists saved_events_user_ref_uniq
  on public.saved_events(user_id, event_ref);
create index if not exists saved_events_user_saved_idx
  on public.saved_events(user_id, saved_at desc);

alter table public.saved_events enable row level security;

drop policy if exists saved_events_owner on public.saved_events;
create policy saved_events_owner on public.saved_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
