-- Real profile-view counter for account analytics. Daily rollup so growth %
-- is computable without storing one row per view. Starts counting at launch;
-- we never backfill invented history. Applied to live project via MCP; mirrored here.
create table if not exists public.profile_view_daily (
  profile_id uuid        not null references public.profiles(id) on delete cascade,
  day        date        not null,
  views      integer     not null default 0,
  viewers    integer     not null default 0,
  primary key (profile_id, day)
);
create index if not exists profile_view_daily_profile_idx on public.profile_view_daily (profile_id, day desc);

alter table public.profile_view_daily enable row level security;
drop policy if exists profile_view_daily_read on public.profile_view_daily;
create policy profile_view_daily_read on public.profile_view_daily for select using (true);

create or replace function public.bump_profile_view(p_profile uuid, p_new_viewer boolean)
returns void language sql as $$
  insert into public.profile_view_daily (profile_id, day, views, viewers)
  values (p_profile, (now() at time zone 'utc')::date, 1, case when p_new_viewer then 1 else 0 end)
  on conflict (profile_id, day) do update
    set views = public.profile_view_daily.views + 1,
        viewers = public.profile_view_daily.viewers + case when p_new_viewer then 1 else 0 end;
$$;
