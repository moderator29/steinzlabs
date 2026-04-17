# Session 5B-1 Batch 1 — Supabase migration

Run `supabase/migrations/2026_session5b1_batch1.sql` in Supabase SQL Editor. Safe to re-run (uses `IF NOT EXISTS` and `DROP POLICY IF EXISTS` guards).

After running, verify these tables exist in **Table Editor**:
1. `limit_orders`
2. `dca_bots`
3. `dca_executions`
4. `stop_loss_orders`
5. `swap_route_analytics`
6. `user_trading_preferences`
7. `user_chart_drawings`
8. `chart_price_alerts`

All have RLS enabled with user-owned + service_role policies.
