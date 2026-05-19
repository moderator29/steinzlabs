import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

/**
 * GET /api/onboarding/variant
 *
 * Deterministic 50/50 A/B variant assignment, keyed by user id so a
 * given user always sees the same variant across sessions / devices.
 * For anonymous visitors we hash a cookie-derived nonce. Variants are
 * recorded in onboarding_events.variant by the client when it fires
 * the 'viewed' event.
 */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619 >>> 0;
  }
  return h >>> 0;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  const key = user?.id ?? req.cookies.get('naka_onboard_nonce')?.value ?? `${Date.now()}-${Math.random()}`;
  const variant: 'a' | 'b' = hash32(`naka-onboard:${key}`) % 2 === 0 ? 'a' : 'b';
  const res = NextResponse.json({ variant });
  if (!user && !req.cookies.get('naka_onboard_nonce')) {
    res.cookies.set('naka_onboard_nonce', String(hash32(key)), { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' });
  }
  return res;
}
