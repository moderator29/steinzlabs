import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminContext, hasPermission, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';

/**
 * POST /api/admin/social/moderate
 *
 * Moderator actions on users + messages. Every action is audit-logged
 * in admin_audit_log so the trail is preserved.
 *
 *   action: 'suspend_social'    body: { user_id, duration_hours }
 *   action: 'unsuspend_social'  body: { user_id }
 *   action: 'force_disable'     body: { user_id }   (sets role='disabled')
 *   action: 'restore_user'      body: { user_id }   (re-enables: role='user')
 *   action: 'remove_message'    body: { message_id }
 *   action: 'restore_message'   body: { message_id }
 */

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('suspend_social'),   user_id: z.string().uuid(), duration_hours: z.number().int().min(1).max(24 * 365) }),
  z.object({ action: z.literal('unsuspend_social'), user_id: z.string().uuid() }),
  z.object({ action: z.literal('force_disable'),    user_id: z.string().uuid() }),
  z.object({ action: z.literal('restore_user'),     user_id: z.string().uuid() }),
  z.object({ action: z.literal('remove_message'),   message_id: z.string().uuid() }),
  z.object({ action: z.literal('restore_message'),  message_id: z.string().uuid() }),
]);

export async function POST(req: NextRequest) {
  // Moderation mutations (suspend, force_disable, remove_message, ...) must
  // require an actual moderation privilege, not merely "is some admin".
  // Without this, a read_only or finance admin could disable users and delete
  // DMs. user.suspend is held by super_admin, support and moderator only.
  const ctx = await verifyAdminContext(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasPermission(ctx.role, 'user.suspend')) {
    return NextResponse.json({ error: 'Forbidden', missingPermission: 'user.suspend' }, { status: 403 });
  }
  const adminId = ctx.userId;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const action = parsed.data.action;
  let targetType = '';
  let targetId = '';
  const metadata: Record<string, unknown> = {};

  if (action === 'suspend_social') {
    const until = new Date(Date.now() + parsed.data.duration_hours * 60 * 60 * 1000).toISOString();
    await sb.from('profiles').update({ social_suspended_until: until }).eq('id', parsed.data.user_id);
    targetType = 'profile'; targetId = parsed.data.user_id;
    metadata.until = until;
  } else if (action === 'unsuspend_social') {
    await sb.from('profiles').update({ social_suspended_until: null }).eq('id', parsed.data.user_id);
    targetType = 'profile'; targetId = parsed.data.user_id;
  } else if (action === 'force_disable') {
    await sb.from('profiles').update({ role: 'disabled' }).eq('id', parsed.data.user_id);
    targetType = 'profile'; targetId = parsed.data.user_id;
  } else if (action === 'restore_user') {
    await sb.from('profiles').update({ role: 'user' }).eq('id', parsed.data.user_id);
    targetType = 'profile'; targetId = parsed.data.user_id;
  } else if (action === 'remove_message') {
    await sb.from('dm_messages').update({ deleted_at: new Date().toISOString() }).eq('id', parsed.data.message_id);
    targetType = 'dm_message'; targetId = parsed.data.message_id;
  } else if (action === 'restore_message') {
    await sb.from('dm_messages').update({ deleted_at: null }).eq('id', parsed.data.message_id);
    targetType = 'dm_message'; targetId = parsed.data.message_id;
  }

  void logAdminAction({
    adminId,
    targetUserId: targetType === 'profile' ? targetId : null,
    action: 'social_moderation',
    details: { sub_action: action, target_type: targetType, target_id: targetId, ...metadata },
  });

  return NextResponse.json({ ok: true });
}
