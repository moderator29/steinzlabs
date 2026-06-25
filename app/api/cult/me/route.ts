import { NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';

export const runtime = 'nodejs';

/**
 * GET /api/cult/me — minimal cult-aware identity for the current user.
 *
 * Why this exists: `profiles.is_chosen` is server-only and intentionally absent
 * from the client `UserProfile` type. Anywhere we want to render Chosen UI
 * (gold trim on TierBadge, dashboard halo, etc.) needs to hit this route
 * instead of trusting client state.
 *
 * Always 200; unauthenticated callers get `{ tier: 'free', isChosen: false }`
 * so the UI can default cleanly without leaking auth state through 401s.
 */
export async function GET() {
  const access = await getCultAccess();
  return NextResponse.json(
    {
      tier: access.tier,
    },
    {
      headers: {
        'cache-control': 'private, no-store',
      },
    }
  );
}
