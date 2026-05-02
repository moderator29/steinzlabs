-- §11 deferral: missing covering indexes for foreign keys.
-- Source: Supabase performance advisor (lint 0001).
-- Strictly additive — every CREATE INDEX is IF NOT EXISTS.
-- Speeds up cascade DELETEs and FK-keyed JOINs.

CREATE INDEX IF NOT EXISTS idx_admin_notes_created_by ON public.admin_notes (created_by);
CREATE INDEX IF NOT EXISTS idx_admin_notes_target_user_id ON public.admin_notes (target_user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements (created_by);
CREATE INDEX IF NOT EXISTS idx_broadcast_templates_created_by ON public.broadcast_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_bubblemap_conversations_user_id ON public.bubblemap_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_label_votes_user_id ON public.cluster_label_votes (user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_labels_submitted_by ON public.cluster_labels (submitted_by);
CREATE INDEX IF NOT EXISTS idx_copy_trades_user_id ON public.copy_trades (user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_whale_id ON public.copy_trades (whale_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_whale_transaction_id ON public.copy_trades (whale_transaction_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON public.email_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_id ON public.feature_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_featured_tokens_added_by ON public.featured_tokens (added_by);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_sent_by ON public.newsletter_sends (sent_by);
CREATE INDEX IF NOT EXISTS idx_platform_fees_transaction_id ON public.platform_fees (transaction_id);
CREATE INDEX IF NOT EXISTS idx_platform_pages_last_edited_by ON public.platform_pages (last_edited_by);
CREATE INDEX IF NOT EXISTS idx_platform_sniper_state_disabled_by ON public.platform_sniper_state (disabled_by);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_subscription_id ON public.push_delivery_log (subscription_id);
CREATE INDEX IF NOT EXISTS idx_research_views_user_id ON public.research_views (user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_user_id ON public.revenue_records (user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON public.search_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_log_changed_by ON public.settings_audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_sniper_match_events_pending_trade_id ON public.sniper_match_events (pending_trade_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON public.support_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_swap_route_analytics_user_id ON public.swap_route_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_trend_alerts_user_id ON public.trend_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_whale_follows_whale_id ON public.user_whale_follows (whale_id);
CREATE INDEX IF NOT EXISTS idx_vtx_conversations_user_id ON public.vtx_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_alpha_reports_generated_by ON public.wallet_alpha_reports (generated_by);
CREATE INDEX IF NOT EXISTS idx_wallet_labels_added_by ON public.wallet_labels (added_by);
CREATE INDEX IF NOT EXISTS idx_whale_submissions_reviewer_id ON public.whale_submissions (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_whale_submissions_submitter_id ON public.whale_submissions (submitter_id);
CREATE INDEX IF NOT EXISTS idx_whale_tracking_whale_id ON public.whale_tracking (whale_id);

-- duplicate_index: drop the narrower one, keep the composite
DROP INDEX IF EXISTS public.login_activity_user_id_idx;
