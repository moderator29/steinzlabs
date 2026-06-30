-- Round-1 audit fixes.

-- HIGH: cron_locks had RLS disabled + full DML granted to anon/authenticated, so
-- any client could hold/reset/delete the trading-engine mutex and halt the money
-- crons. Lock it to the service role (the cron functions bypass RLS), like
-- aa_auth_nonces — enable RLS with NO client policy = deny-all to clients.
alter table public.cron_locks enable row level security;

-- INFO: clear the security_definer_view advisor on the OG feed view (it only
-- reads sniper_feed_tokens, which is already authenticated-readable, so this is
-- hygiene/parity, not a leak fix).
alter view public.sniper_feed_og set (security_invoker = true);
