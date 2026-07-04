import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/telegram/unlink — disconnect the authenticated user's Telegram
// link from the app side (previously the "Disconnect" button was fake: it only
// alerted the user to go type /unlink in the bot). Deletes the row for the
// current user so alerts stop immediately.
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_telegram_links')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
