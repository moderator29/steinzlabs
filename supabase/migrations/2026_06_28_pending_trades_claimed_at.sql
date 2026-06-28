-- #11 funds-safety: atomic claim guard for signed pending trades.
-- The in-browser auto-sign path (auto_confirm) could otherwise double-
-- broadcast if the banner remounts mid-sign or runs in two tabs: the only
-- guard was an in-memory ref. claimed_at lets the server reject a second
-- claim within a short window, so at most one broadcast can happen per
-- trade. Stale claims (client died mid-sign) free up after the window for
-- retry. Nullable + defaults NULL so existing rows/paths are unaffected.
ALTER TABLE public.pending_trades
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
