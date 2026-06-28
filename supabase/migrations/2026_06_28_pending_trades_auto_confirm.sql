-- Auto-Copy (client-armed, non-custodial). The matcher/relayer have long
-- referenced a `pending_trades.auto_confirm` flag in comments, but it was never
-- created. Add it: when an auto_copy copy-rule produces a pending trade, this
-- flag tells the in-browser PendingTradesBanner it may auto-sign WITHOUT a
-- manual click — but only while the app is open and the built-in wallet is
-- unlocked (keys never leave the browser; the server still never signs).
-- Defaults false so every existing/one-click path keeps its manual confirm.
ALTER TABLE public.pending_trades
  ADD COLUMN IF NOT EXISTS auto_confirm boolean NOT NULL DEFAULT false;
