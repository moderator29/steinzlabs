import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { guardRoute } from '@/lib/api/guardRoute';

/**
 * SC2: HaveIBeenPwned breach check for the user's email.
 *
 * GET → looks up the authenticated user's email at the HIBP breaches
 * endpoint and stores the count on user_security_profile.breach_count
 * so the Security Center can surface a "Your email appeared in N
 * breaches" banner.
 *
 * HIBP requires a paid API key (HIBP_API_KEY) and applies a per-key
 * rate limit; we cache the result on user_security_profile for 7 days.
 */

export const runtime = 'nodejs';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const guard = await guardRoute(req, { rate: 'low' });
  if (!guard.ok) return guard.response;

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('user_security_profile')
    .select('breach_count, last_breach_check')
    .eq('user_id', user.id)
    .maybeSingle<{ breach_count: number | null; last_breach_check: string | null }>();

  if (existing?.last_breach_check && Date.now() - new Date(existing.last_breach_check).getTime() < WEEK_MS) {
    return NextResponse.json({ count: existing.breach_count ?? 0, cached: true });
  }

  const key = process.env.HIBP_API_KEY;
  if (!key) {
    // No key configured — return cached value if any, otherwise 0.
    return NextResponse.json({ count: existing?.breach_count ?? 0, cached: false, configured: false });
  }

  try {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(user.email)}?truncateResponse=true`,
      {
        headers: { 'hibp-api-key': key, 'user-agent': 'NakaLabs-SecurityCenter' },
        signal: AbortSignal.timeout(6000),
      },
    );
    let count = 0;
    if (res.status === 200) {
      const arr = await res.json() as Array<unknown>;
      count = Array.isArray(arr) ? arr.length : 0;
    } else if (res.status === 404) {
      count = 0;                                          // no breaches
    } else if (res.status === 429) {
      return NextResponse.json({ count: existing?.breach_count ?? 0, cached: true, rateLimited: true });
    } else {
      return NextResponse.json({ error: `HIBP returned ${res.status}` }, { status: 502 });
    }

    await admin.from('user_security_profile').upsert({
      user_id: user.id,
      breach_count: count,
      last_breach_check: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ count, cached: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'HIBP check failed' }, { status: 502 });
  }
}
