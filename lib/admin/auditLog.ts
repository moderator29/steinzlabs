import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Admin audit log helper. Writes a single append-only row to
 * public.admin_audit_log for every meaningful write performed by an
 * admin route. Wrap every POST/PATCH/DELETE in /api/admin/* with a
 * single logAdminAction() call.
 *
 * Failure is non-fatal — if Supabase is unreachable we capture to
 * Sentry and continue. The admin action itself is the source of
 * truth; the audit row is a compliance bonus. Better to ship the
 * change with a missing log entry than to block on a flaky DB.
 *
 * Schema: supabase/migrations/2026_admin_audit_log.sql
 */

export type AdminAuditAction =
  | 'set_tier'
  | 'set_role'
  | 'ban'
  | 'unban'
  | 'delete'
  | 'copy_rule_create'
  | 'copy_rule_update'
  | 'copy_rule_delete'
  | 'copy_trade_execute'
  // HIGH-6: extend the action vocabulary so every admin mutation route
  // can stamp a precise verb. The audit log's `details` jsonb carries
  // the per-action payload (target id, before/after, etc).
  | 'announcement_create'
  | 'announcement_update'
  | 'announcement_delete'
  | 'broadcast_send'
  | 'broadcast_create'
  | 'email_template_create'
  | 'email_template_update'
  | 'email_template_delete'
  | 'featured_token_set'
  | 'featured_token_remove'
  | 'flagged_token_set'
  | 'flagged_token_clear'
  | 'newsletter_send'
  | 'research_publish'
  | 'research_unpublish'
  | 'research_delete'
  | 'research_upload'
  | 'settings_update'
  | 'support_reply'
  | 'support_status_change'
  | 'social_moderation'
  | 'social_report_resolve'
  | 'wallet_label_set'
  | 'wallet_label_clear'
  | 'whale_submission_approve'
  | 'whale_submission_reject'
  | 'whale_discover'
  | 'whale_verify'
  | 'other';

export interface AdminAuditEntry {
  adminId: string;
  targetUserId?: string | null;
  action: AdminAuditAction;
  details?: Record<string, unknown>;
}

export async function logAdminAction(entry: AdminAuditEntry): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('admin_audit_log').insert({
      admin_id: entry.adminId,
      target_user_id: entry.targetUserId ?? null,
      action: entry.action,
      details: entry.details ?? null,
    });
    if (error) throw error;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: 'admin-audit-log' },
      extra: {
        adminId: entry.adminId,
        targetUserId: entry.targetUserId ?? null,
        action: entry.action,
      },
    });
  }
}
