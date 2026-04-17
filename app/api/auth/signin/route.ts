import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const maxDuration = 15; // seconds — prevents Vercel cutting off before our timeout

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBodmV3cmxkY2R4dXBzbmFrZGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA0NjMsImV4cCI6MjA5MDc3NjQ2M30.xHGPMphDjMsPN566gRcGle5Mp8mEBxGiI1HXDX9M7ZU';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: 'Sign in timed out. Please try again.' }, { status: 408 });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error_description || data?.error || data?.message || 'Invalid credentials';
      const lower = msg.toLowerCase();

      if (lower.includes('not confirmed') || lower.includes('email not confirmed')) {
        return NextResponse.json({ error: 'EMAIL_NOT_CONFIRMED' }, { status: 403 });
      }
      if (lower.includes('invalid') || lower.includes('credentials') || lower.includes('wrong')) {
        return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
      }
      if (lower.includes('rate') || lower.includes('too many')) {
        return NextResponse.json({ error: 'Too many attempts. Wait a moment and try again.' }, { status: 429 });
      }
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    if (!data.access_token) {
      return NextResponse.json({ error: 'Sign in failed. Please try again.' }, { status: 500 });
    }

    let profile = null;
    try {
      const admin = getSupabaseAdmin();
      const { data: profileData } = await admin
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single();
      profile = profileData;
    } catch (err) {
      console.error('[signin] Profile fetch failed:', err);
      Sentry.captureException(err);
    }

    // Log login activity (non-blocking)
    if (data.user?.id) {
      try {
        const admin = getSupabaseAdmin();
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request.headers.get('x-real-ip')
          || 'Unknown';
        admin.from('login_activity').insert({
          user_id: data.user.id,
          user_agent: userAgent,
          ip,
        }).then(({ error }) => {
          if (error) console.error('[signin] login_activity insert failed:', error.message);
        });
      } catch (err) {
        console.error('[signin] login activity logging failed:', err);
      }
    }

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      user: data.user,
      profile,
    });
  } catch (err: any) {
    console.error('[signin] failed:', err);
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Sign in failed. Please try again.' }, { status: 500 });
  }
}
