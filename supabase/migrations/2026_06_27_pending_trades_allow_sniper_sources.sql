-- Allow the sniper pipeline to queue trades. The auto-execute buy and autosell
-- sell write source_order_table='sniper_executions' and source_reason of
-- 'sniper_buy' / 'sniper_autosell', which the prior CHECKs rejected (23514),
-- making the entire sniper trade pipeline dead on arrival. wallet_source is
-- intentionally NOT extended — sniper criteria values are mapped to the
-- relayer vocabulary (external_evm/external_solana/builtin) in code.
ALTER TABLE public.pending_trades DROP CONSTRAINT IF EXISTS pending_trades_source_order_table_check;
ALTER TABLE public.pending_trades ADD CONSTRAINT pending_trades_source_order_table_check
  CHECK (source_order_table = ANY (ARRAY['limit_orders','dca_bots','stop_loss_orders','user_copy_trades','sniper_executions']));

ALTER TABLE public.pending_trades DROP CONSTRAINT IF EXISTS pending_trades_source_reason_check;
ALTER TABLE public.pending_trades ADD CONSTRAINT pending_trades_source_reason_check
  CHECK (source_reason = ANY (ARRAY['limit_order','dca','stop_loss','take_profit','trail_stop','copy_trade','vtx_chat','sniper_buy','sniper_autosell']));
