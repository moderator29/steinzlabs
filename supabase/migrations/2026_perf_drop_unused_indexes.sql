-- §11 deferral: drop indexes that pg_stat_user_indexes confirms have
-- never been used by any query since stats collection started.
-- Source: Supabase advisor lint 0005.
--
-- Safety: skip indexes that back a constraint (PK / UNIQUE / EXCLUDE) —
-- Postgres requires dropping the constraint first, and we don't want
-- to lose uniqueness guarantees by accident. Skip indexes named after
-- the FK indexes added in 2026_perf_fk_covering_indexes.sql (those
-- read as "unused" until a query exercises them).
--
-- Idempotent — re-running drops nothing because the targets are gone.

DO $body$
DECLARE
  idx RECORD;
  dropped INT := 0;
  fk_indexes TEXT[] := ARRAY[
    'idx_admin_notes_created_by','idx_admin_notes_target_user_id',
    'idx_announcements_created_by','idx_broadcast_templates_created_by',
    'idx_bubblemap_conversations_user_id','idx_cluster_label_votes_user_id',
    'idx_cluster_labels_submitted_by','idx_copy_trades_user_id',
    'idx_copy_trades_whale_id','idx_copy_trades_whale_transaction_id',
    'idx_email_templates_created_by','idx_feature_usage_user_id',
    'idx_featured_tokens_added_by','idx_newsletter_sends_sent_by',
    'idx_platform_fees_transaction_id','idx_platform_pages_last_edited_by',
    'idx_platform_sniper_state_disabled_by','idx_push_delivery_log_subscription_id',
    'idx_research_views_user_id','idx_revenue_records_user_id',
    'idx_search_logs_user_id','idx_settings_audit_log_changed_by',
    'idx_sniper_match_events_pending_trade_id','idx_support_conversations_user_id',
    'idx_support_tickets_user_id','idx_swap_route_analytics_user_id',
    'idx_transactions_user_id','idx_trend_alerts_user_id',
    'idx_user_whale_follows_whale_id','idx_vtx_conversations_user_id',
    'idx_wallet_alpha_reports_generated_by','idx_wallet_labels_added_by',
    'idx_whale_submissions_reviewer_id','idx_whale_submissions_submitter_id',
    'idx_whale_tracking_whale_id'
  ];
BEGIN
  FOR idx IN
    SELECT s.schemaname, s.relname AS tablename, s.indexrelname AS indexname
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON i.indexrelid = s.indexrelid
    WHERE s.schemaname = 'public'
      AND s.idx_scan = 0
      AND NOT i.indisunique
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conindid = s.indexrelid
      )
      AND NOT (s.indexrelname = ANY(fk_indexes))
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schemaname, idx.indexname);
    dropped := dropped + 1;
  END LOOP;

  RAISE NOTICE 'Dropped % unused indexes', dropped;
END $body$;
