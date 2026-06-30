import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * PATCH /api/notifications/[id]/read — mark a single notification read.
 *
 * Security (IDOR fix): the update is bound to the authenticated session user
 * via `.eq('user_id', user.id)`. Previously the service-role update keyed only
 * on the row id, so any authenticated caller could flip the read flag on ANY
 * user's notification by guessing/enumerating ids.
 *
 * Supabase-backed ids arrive prefixed with `sb-` (see /api/notifications GET).
 * Local-only ids (market feed / client store) have no DB row — those are
 * acknowledged client-side via the steinz_read_notifs list, so we no-op here.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
  }

  // Only Supabase-backed rows are durable; local-only ids are handled client-side.
  if (!id.startsWith('sb-')) {
    return NextResponse.json({ success: true, id, persisted: false });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseId = id.replace('sb-', '');
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', supabaseId)
      .eq('user_id', user.id);

    if (error) {
      Sentry.captureException(error, {
        tags: { route: 'notifications/[id]/read', stage: 'update' },
        extra: { notification_id: supabaseId },
      });
      return NextResponse.json({ error: 'Failed to mark notification read' }, { status: 500 });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'notifications/[id]/read', stage: 'update' },
      extra: { notification_id: supabaseId },
    });
    return NextResponse.json({ error: 'Failed to mark notification read' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id, persisted: true });
}
