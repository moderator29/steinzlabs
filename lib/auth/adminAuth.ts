import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * ADM1: admin authentication with granular role + permission matrix.
 *
 * Returns the verified admin user + role, or null if the request can't
 * authenticate. Existing callers that just check truthiness keep working
 * because the legacy verifyAdminRequest signature is preserved.
 */

export type AdminRole = 'super_admin' | 'support' | 'moderator' | 'finance' | 'read_only';

export type AdminPermission =
  | 'admin.read'              // any admin can read
  | 'admin.audit.read'
  | 'feature_flag.toggle'
  | 'cron.trigger'
  | 'user.suspend'
  | 'user.impersonate'
  | 'user.delete'
  | 'finance.read'
  | 'finance.write'
  | 'whale.curate'
  | 'research.publish'
  | 'role.grant';

const PERMISSION_MATRIX: Record<AdminRole, ReadonlyArray<AdminPermission>> = {
  super_admin: [
    'admin.read', 'admin.audit.read', 'feature_flag.toggle', 'cron.trigger',
    'user.suspend', 'user.impersonate', 'user.delete',
    'finance.read', 'finance.write', 'whale.curate', 'research.publish', 'role.grant',
  ],
  support: [
    'admin.read', 'admin.audit.read', 'user.suspend', 'user.impersonate',
  ],
  moderator: [
    'admin.read', 'whale.curate', 'research.publish', 'user.suspend',
  ],
  finance: [
    'admin.read', 'finance.read', 'finance.write',
  ],
  read_only: [
    'admin.read', 'admin.audit.read', 'finance.read',
  ],
};

export interface AdminContext {
  userId: string;
  role: AdminRole;
  /** True only when the bearer is the static ADMIN_BEARER_TOKEN (no role granularity). */
  staticBearer: boolean;
}

export function hasPermission(role: AdminRole, perm: AdminPermission): boolean {
  return PERMISSION_MATRIX[role].includes(perm);
}

/**
 * Legacy entry point — preserved so existing callers keep compiling.
 * New code should prefer `verifyAdminContext` which returns the role.
 */
export async function verifyAdminRequest(request: Request): Promise<string | null> {
  const ctx = await verifyAdminContext(request);
  return ctx?.userId ?? null;
}

export async function verifyAdminContext(request: Request): Promise<AdminContext | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    if (!token) return null;

    // Static ADMIN_BEARER_TOKEN — treated as super_admin so existing
    // cron + integration callers keep working.
    const adminBearerToken = process.env.ADMIN_BEARER_TOKEN;
    if (adminBearerToken && token === adminBearerToken) {
      return { userId: 'admin-bearer', role: 'super_admin', staticBearer: true };
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Prefer admin_roles (ADM1); fall back to legacy profiles.role='admin'
    // so a pre-migration session doesn't get locked out.
    const { data: roleRow } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle<{ role: AdminRole }>();

    if (roleRow?.role) {
      return { userId: user.id, role: roleRow.role, staticBearer: false };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>();
    if (profile?.role !== 'admin') return null;
    return { userId: user.id, role: 'super_admin', staticBearer: false };
  } catch {
    return null;
  }
}

export async function requirePermission(
  request: Request,
  perm: AdminPermission,
): Promise<AdminContext | Response> {
  const ctx = await verifyAdminContext(request);
  if (!ctx) return unauthorizedResponse();
  if (!hasPermission(ctx.role, perm)) {
    return new Response(JSON.stringify({ error: 'Forbidden', missingPermission: perm }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return ctx;
}

export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Helper for admin mutations — writes a row to admin_audit_log so every
 * change is durably attributable. Fire-and-forget; never let logging
 * failure block the action.
 */
export async function logAdminAction(
  ctx: AdminContext,
  input: {
    action: string;
    target_type?: string;
    target_id?: string;
    before_state?: Record<string, unknown> | null;
    after_state?: Record<string, unknown> | null;
    ip_address?: string | null;
    user_agent?: string | null;
  },
): Promise<void> {
  if (ctx.staticBearer) return;       // no user_id to attribute against
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('admin_audit_log').insert({
      admin_id: ctx.userId,
      action: input.action,
      target_type: input.target_type ?? null,
      target_user_id: input.target_type === 'user' ? input.target_id : null,
      details: {
        target_id: input.target_id ?? null,
        before: input.before_state ?? null,
        after: input.after_state ?? null,
      },
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
    });
  } catch { /* logging failure never blocks the mutation */ }
}
