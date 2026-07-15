import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeReferralCode } from '@/lib/referral/referralCode';

export const dynamic = 'force-dynamic';

/**
 * POST /api/referrals/claim { code } — the caller applies a friend's referral
 * code. A user can be referred once, ever (referrals.referee_id is unique), so
 * a repeat claim returns a clear "already referred" message rather than a 500.
 */
export async function POST(req: NextRequest) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const code = normalizeReferralCode(typeof body.code === 'string' ? body.code : null);
  if (!code) {
    return NextResponse.json({ error: 'Enter a valid referral code.' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Resolve code -> referrer.
  const { data: codeRow } = await sb
    .from('referral_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle();

  const referrerId = (codeRow as { user_id: string } | null)?.user_id;
  if (!referrerId) {
    return NextResponse.json({ error: "That code doesn't match anyone." }, { status: 404 });
  }

  if (referrerId === me.id) {
    return NextResponse.json({ error: "You can't refer yourself." }, { status: 400 });
  }

  // Already referred? referee_id is unique, so this can never change once set.
  const { data: existing } = await sb
    .from('referrals')
    .select('id')
    .eq('referee_id', me.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You've already been referred." }, { status: 409 });
  }

  const { error: insertError } = await sb
    .from('referrals')
    .insert({ referrer_id: referrerId, referee_id: me.id, code });

  if (insertError) {
    // Unique-violation race: a concurrent claim landed first. Treat as the
    // idempotent "already referred" case, not a server error.
    if (insertError.code === '23505') {
      return NextResponse.json({ error: "You've already been referred." }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not apply that code. Please try again.' }, { status: 500 });
  }

  // Return the referrer's public handle for a friendly confirmation.
  const { data: referrer } = await sb
    .from('profiles')
    .select('username, display_name')
    .eq('id', referrerId)
    .maybeSingle();

  const p = referrer as { username: string | null; display_name: string | null } | null;
  const handle = p?.username || p?.display_name || 'a Naka trader';

  return NextResponse.json({ ok: true, referrer: handle });
}
