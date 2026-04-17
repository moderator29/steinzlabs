import 'server-only';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return NextResponse.json({ sessions: [] });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('login_activity')
      .select('id, user_agent, ip, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[login-activity GET] query failed:', error);
      return NextResponse.json({ sessions: [] });
    }

    const sessions = (data || []).map((s, idx) => ({
      ...s,
      current: idx === 0,
    }));

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('[login-activity GET] failed:', err);
    Sentry.captureException(err);
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'Unknown';

    const { error } = await supabase.from('login_activity').insert({
      user_id: body.userId,
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
