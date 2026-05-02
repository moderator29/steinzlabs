-- §3.3a / §3.3d — explicit FK ON DELETE behavior + storage bucket hardening.
-- See docs/cleanup-2026-05/schema-storage-realtime-audit-2026-05-02.md for
-- the audit findings and rationale per choice.
-- Applied to live DB via Supabase MCP (migration: session_d_schema_storage_audit_fixes).

-- copy_trades: SET NULL preserves the user's trade history if a whale or
-- whale_transaction is later deleted.
ALTER TABLE public.copy_trades
  DROP CONSTRAINT IF EXISTS copy_trades_whale_id_fkey,
  ADD  CONSTRAINT copy_trades_whale_id_fkey
       FOREIGN KEY (whale_id) REFERENCES public.whale_wallets(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.copy_trades
  DROP CONSTRAINT IF EXISTS copy_trades_whale_transaction_id_fkey,
  ADD  CONSTRAINT copy_trades_whale_transaction_id_fkey
       FOREIGN KEY (whale_transaction_id) REFERENCES public.whale_transactions(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- platform_fees: CASCADE — a fee row without its parent transaction has no meaning.
ALTER TABLE public.platform_fees
  DROP CONSTRAINT IF EXISTS platform_fees_transaction_id_fkey,
  ADD  CONSTRAINT platform_fees_transaction_id_fkey
       FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- sniper_match_events: CASCADE.
ALTER TABLE public.sniper_match_events
  DROP CONSTRAINT IF EXISTS sniper_match_events_pending_trade_id_fkey,
  ADD  CONSTRAINT sniper_match_events_pending_trade_id_fkey
       FOREIGN KEY (pending_trade_id) REFERENCES public.pending_trades(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- whale_tracking: CASCADE.
ALTER TABLE public.whale_tracking
  DROP CONSTRAINT IF EXISTS whale_tracking_whale_id_fkey,
  ADD  CONSTRAINT whale_tracking_whale_id_fkey
       FOREIGN KEY (whale_id) REFERENCES public.whale_wallets(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- whale_transactions: CASCADE.
ALTER TABLE public.whale_transactions
  DROP CONSTRAINT IF EXISTS whale_transactions_whale_id_fkey,
  ADD  CONSTRAINT whale_transactions_whale_id_fkey
       FOREIGN KEY (whale_id) REFERENCES public.whale_wallets(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- §3.3d — research-images bucket: 5 MB cap + image-only MIME allow-list.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE id = 'research-images';
