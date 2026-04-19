-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — SESSION 5B-2 — pending_trades vtx_chat reason
--
-- VTX Agent's prepare_swap tool stages user-confirmed swaps from
-- in-chat intent. Add 'vtx_chat' to pending_trades.source_reason
-- CHECK constraint so the relayer can persist them.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE pending_trades DROP CONSTRAINT IF EXISTS pending_trades_source_reason_check;

ALTER TABLE pending_trades ADD CONSTRAINT pending_trades_source_reason_check
  CHECK (source_reason IN (
    'limit_order', 'dca', 'stop_loss', 'take_profit', 'trail_stop',
    'copy_trade', 'vtx_chat'
  ));
