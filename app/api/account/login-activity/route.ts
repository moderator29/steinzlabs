import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

// Login/session activity is strictly self-scoped. Both handlers derive the
// user from the verified session and IGNORE any client-supplied ?userId /
// body.userId — previously the GET read any user's sessions by query param
// (IDOR) and the POST inserted a login_activity row for an arbitrary userId
// via the service role (session-log forgery: an attacker could plant a row
// that the GET then reports as the victim's "current session").

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ sessions: [] }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('login_activity')
      .select('id, user_agent, ip, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[login-activity GET] query failed:', error);
      return NextResponse.json({ sessions: [] });
    }

    const sessions = (data || []).map((s, idx) => ({ ...s, current: idx === 0 }));
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('[login-activity GET] failed:', err);
    Sentry.captureException(err);
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'Unknown';

    const { error } = await supabase.from('login_activity').insert({
      user_id: user.id,
      user_agent: userAgent,
      ip,
    });

    if (error) {
      console.error('[login-activity POST] insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[login-activity POST] failed:', err);
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Failed to log login' }, { status: 500 });
  }
}
