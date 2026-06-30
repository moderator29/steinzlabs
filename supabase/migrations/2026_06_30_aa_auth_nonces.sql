-- Audit #47 H1 (full): single-use nonce for the AA session-key approve flow.
-- The server issues a nonce at init; the owner signs it inside the EIP-712
-- Authorization struct; approve consumes it atomically. Combined with chainId in
-- the EIP-712 domain, this stops capture-replay of an approval signature across
-- deployments/chains and prevents re-creating a revoked grant.
create table if not exists aa_auth_nonces (
  nonce text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists aa_auth_nonces_user_idx on aa_auth_nonces (user_id);
-- Service-role only (the route uses the admin client); deny all to clients.
alter table aa_auth_nonces enable row level security;
