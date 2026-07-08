-- 20260708_perf_indexes_hotpaths_and_fks.sql
-- DB hardening (performance). ADDITIVE ONLY — every statement is CREATE INDEX
-- IF NOT EXISTS, so re-running is a no-op and nothing existing is dropped or
-- altered. Names are chosen so they can also be created CONCURRENTLY out-of-band
-- if a future large table needs a lock-free build.
--
-- Two groups:
--   (A) Hot-path composite / partial indexes for the app's dominant queries.
--   (B) Covering indexes for the 34 foreign keys flagged by the Supabase
--       performance advisor (unindexed_foreign_keys) — speeds FK joins and
--       cascade checks.

-- ─────────────────────────────────────────────────────────────────────────────
-- (A) HOT PATHS
-- ─────────────────────────────────────────────────────────────────────────────

-- Whale directory default view (app/api/whales/directory): filters is_active
-- and orders by portfolio_value_usd DESC with whale_score / last_active_at
-- tiebreaks, paginated. Partial + composite matches the exact ORDER BY so the
-- default (and hottest) directory page is a plain index scan, no sort.
CREATE INDEX IF NOT EXISTS idx_whales_active_portfolio_rank
  ON public.whales (portfolio_value_usd DESC NULLS LAST, whale_score DESC NULLS LAST, last_active_at DESC NULLS LAST)
  WHERE is_active = true;

-- VTX conversation list (app/api/vtx/conversations): WHERE user_id = $ ORDER BY
-- updated_at DESC LIMIT 50. Existing index is user_id only, so the sort spilled.
CREATE INDEX IF NOT EXISTS idx_vtx_conversations_user_updated
  ON public.vtx_conversations (user_id, updated_at DESC);

-- Wallet-graph BFS traversal (network-graph/path, clusters/by-address,
-- sybil-clusters) walks edges in BOTH directions: .in('from_address', frontier)
-- AND .in('to_address', frontier). from_address is the lead column of the
-- existing unique index, but to_address had no usable index.
CREATE INDEX IF NOT EXISTS idx_wallet_edges_to_address
  ON public.wallet_edges (to_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- (B) UNINDEXED FOREIGN KEYS (advisor: unindexed_foreign_keys)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_admin_impersonation_tokens_admin_id   ON public.admin_impersonation_tokens (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_tokens_target_id  ON public.admin_impersonation_tokens (target_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_granted_by                ON public.admin_roles (granted_by);
CREATE INDEX IF NOT EXISTS idx_context_feed_engagement_user_id       ON public.context_feed_engagement (user_id);
CREATE INDEX IF NOT EXISTS idx_cult_daily_seal_drafts_reviewed_by    ON public.cult_daily_seal_drafts (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_cult_echo_wallets_added_by            ON public.cult_echo_wallets (added_by);
CREATE INDEX IF NOT EXISTS idx_cult_hall_messages_user_id            ON public.cult_hall_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_cult_member_achievements_achievement_id ON public.cult_member_achievements (achievement_id);
CREATE INDEX IF NOT EXISTS idx_cult_member_achievements_granted_by   ON public.cult_member_achievements (granted_by);
CREATE INDEX IF NOT EXISTS idx_cult_member_loadouts_cosmetic_id      ON public.cult_member_loadouts (cosmetic_id);
CREATE INDEX IF NOT EXISTS idx_cult_offering_entries_user_id         ON public.cult_offering_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_cult_offerings_winner_user_id         ON public.cult_offerings (winner_user_id);
CREATE INDEX IF NOT EXISTS idx_cult_proposal_comments_author_id      ON public.cult_proposal_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_cult_proposal_comments_parent_id      ON public.cult_proposal_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_cult_proposal_votes_voter_id          ON public.cult_proposal_votes (voter_id);
CREATE INDEX IF NOT EXISTS idx_cult_proposals_author_id              ON public.cult_proposals (author_id);
CREATE INDEX IF NOT EXISTS idx_cult_whisper_votes_voter_id           ON public.cult_whisper_votes (voter_id);
CREATE INDEX IF NOT EXISTS idx_cult_whispers_author_id               ON public.cult_whispers (author_id);
CREATE INDEX IF NOT EXISTS idx_dca_executions_bot_id                 ON public.dca_executions (bot_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_last_message_sender  ON public.dm_conversations (last_message_sender);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_requested_by         ON public.dm_conversations (requested_by);
CREATE INDEX IF NOT EXISTS idx_dune_alerts_user_id                   ON public.dune_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_post_id                    ON public.engagement (post_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_by              ON public.feature_flags (updated_by);
CREATE INDEX IF NOT EXISTS idx_limit_orders_pending_trade_id         ON public.limit_orders (pending_trade_id);
CREATE INDEX IF NOT EXISTS idx_mm_fills_user_id                      ON public.mm_fills (user_id);
CREATE INDEX IF NOT EXISTS idx_mm_orders_user_id                     ON public.mm_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_pending_discord_messages_user_id      ON public.pending_discord_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_pending_sms_messages_user_id          ON public.pending_sms_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_sniper_executions_criteria_id         ON public.sniper_executions (criteria_id);
CREATE INDEX IF NOT EXISTS idx_sniper_match_events_criteria_id       ON public.sniper_match_events (criteria_id);
CREATE INDEX IF NOT EXISTS idx_social_mutes_muted_id                 ON public.social_mutes (muted_id);
CREATE INDEX IF NOT EXISTS idx_stop_loss_orders_pending_trade_id     ON public.stop_loss_orders (pending_trade_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id              ON public.user_reports (reporter_id);
