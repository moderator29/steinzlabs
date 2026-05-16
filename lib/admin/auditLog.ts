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
