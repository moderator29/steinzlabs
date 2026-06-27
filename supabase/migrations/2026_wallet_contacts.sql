-- Address book / saved contacts for the in-app wallet Send flow.
create table if not exists public.user_wallet_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address text not null,
  chain text,
  created_at timestamptz not null default now(),
  unique (user_id, address, chain)
);
create index if not exists user_wallet_contacts_user_idx on public.user_wallet_contacts(user_id);
alter table public.user_wallet_contacts enable row level security;
drop policy if exists wallet_contacts_owner on public.user_wallet_contacts;
create policy wallet_contacts_owner on public.user_wallet_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
