import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest } from '@/lib/auth/adminAuth';

export async function POST(request: Request) {
  try {
    // SECURITY: this force-confirms an arbitrary account's email via the
    // service role, bypassing the signed-token verification that the real
    // flow (GET /api/auth/verify-email) enforces. Left unauthenticated it is
    // a full email-verification bypass / account-takeover primitive (register
    // with a victim's email, then self-confirm without inbox access). It has
    // no in-app callers; restrict it to admins so only staff can manually
    // confirm a user. Legitimate confirmation happens via the token flow.
    const adminId = await verifyAdminRequest(request);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: { users } } = await admin.auth.admin.listUsers();
    const user = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    Sentry.captureException(err, { tags: { route: 'auth/confirm-user', phase: 'admin-update' } });
    return NextResponse.json({ error: 'Failed to confirm user' }, { status: 500 });
  }
}
