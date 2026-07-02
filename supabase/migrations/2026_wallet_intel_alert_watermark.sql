-- Forward-only dedup watermark for user_wallet_alerts.
--
-- The alert-monitor cron now evaluates active user_wallet_alerts against real
-- on-chain activity and dispatches via fanOutNotification. To avoid re-firing
-- the same transaction it needs a per-row watermark, mirroring
-- user_whale_follows.last_alerted_at:
--   * last_alerted_at — advanced forward every evaluation (scan window floor)
--   * last_seen_tx    — the last transaction hash/signature we already alerted,
--                       used for the CAS claim that prevents concurrent ticks
--                       from double-firing the same event.
--
-- Idempotent: safe to re-run.

ALTER TABLE user_wallet_alerts
  ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_tx TEXT;
