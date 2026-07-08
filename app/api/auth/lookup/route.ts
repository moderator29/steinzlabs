import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // This endpoint resolves a username to its account email for the
    // username-login flow, so it necessarily returns PII (the email) to an
    // UNAUTHENTICATED caller. Without a rate limit it is a mass username→email
    // harvesting / account-enumeration oracle (and each miss also triggers an
    // expensive admin.listUsers scan). Bucket per source IP to keep the flow
    // usable for real logins while blocking bulk enumeration.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await rateLimit(`auth:lookup:${ip}`, { interval: 60_000, maxRequests: 10 });
    if (!rl.success) return rateLimitResponse(rl);

    const { username } = await request.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .ilike('username', username)
      .limit(1)
      .single();

    if (profile?.email) {
      return NextResponse.json({ email: profile.email });
    }

    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersData?.users) {
      const match = usersData.users.find(
        (u: any) => u.user_metadata?.username?.toLowerCase() === username.toLowerCase()
      );
      if (match?.email) {
        try {
          await admin.from('profiles').upsert({
            id: match.id,
            username: match.user_metadata?.username,
            email: match.email,
            first_name: match.user_metadata?.first_name || '',
            last_name: match.user_metadata?.last_name || '',
          }, { onConflict: 'id' });
        } catch (err) {
          Sentry.captureException(err, { tags: { route: 'auth/lookup', phase: 'profile-upsert' } });
        }
        return NextResponse.json({ email: match.email });
      }
    }

    return NextResponse.json({ error: 'No account found with that username.' }, { status: 404 });
  } catch (err: any) {
    Sentry.captureException(err, { tags: { route: 'auth/lookup' } });
    return NextResponse.json({ error: 'Unable to look up username.' }, { status: 500 });
  }
}
