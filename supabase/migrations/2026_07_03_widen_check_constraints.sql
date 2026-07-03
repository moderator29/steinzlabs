-- 2026-07-03 — widen three CHECK constraints that were silently rejecting
-- legitimate writes (found by the 40-agent audit, verified against live DB).
--
-- 1. admin_audit_log.action allowed only 6 values while the code writes ~35
--    distinct action strings — so EVERY real admin action failed the CHECK
--    and no audit row was ever written. An audit log must never reject a
--    write (losing the record is worse than an odd value), so the CHECK is
--    relaxed to a non-empty guard.
-- 2. user_copy_trades.status rejected 'blocked_rule', which the copy matcher
--    writes when a follower's rule blocks a copy — the row insert failed.
-- 3. pending_trades.source_reason rejected 'bridge', which the bridge execute
--    route writes — so bridge intents could never be recorded.
--
-- All idempotent and additive (only widen what is allowed; no data touched).

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IS NOT NULL AND length(action) BETWEEN 1 AND 100);

ALTER TABLE public.user_copy_trades DROP CONSTRAINT IF EXISTS user_copy_trades_status_check;
ALTER TABLE public.user_copy_trades
  ADD CONSTRAINT user_copy_trades_status_check
  CHECK (status = ANY (ARRAY[
    'pending','success','failed','cancelled','expired','alert',
    'blocked_rule','blocked_security'
  ]));

ALTER TABLE public.pending_trades DROP CONSTRAINT IF EXISTS pending_trades_source_reason_check;
ALTER TABLE public.pending_trades
  ADD CONSTRAINT pending_trades_source_reason_check
  CHECK (source_reason = ANY (ARRAY[
    'limit_order','dca','stop_loss','take_profit','trail_stop','copy_trade',
    'vtx_chat','sniper_buy','sniper_autosell','bridge'
  ]));
