import 'server-only';
import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * HIGH-5: guard that requires a fresh re-auth proof for sensitive ops.
 * Routes that need this protection call:
 *
 *   const guard = await requireRecentAuth(request, userId);
 *   if (guard) return guard;  // 401 response — caller already handled
 *
 * The cookie is minted by POST /api/auth/re-auth and lives 5 minutes.
 * We re-verify the JWT here (signature + expiry + user binding) so a
 * stolen cookie from a different user can't drift across sessions.
 */

const COOKIE_NAME = 'naka_recent_auth';

function secret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('JWT_SECRET or SESSION_SECRET required');
  return new TextEncoder().encode(s);
}

export async function requireRecentAuth(
  request: NextRequest,
  expectedUserId: string,
): Promise<NextResponse | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'Re-authentication required', code: 'reauth_required' },
      { status: 401 },
    );
  }
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.user_id !== expectedUserId) {
      return NextResponse.json(
        { error: 'Re-auth token belongs to a different user', code: 'reauth_mismatch' },
        { status: 401 },
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { error: 'Re-auth token expired or invalid', code: 'reauth_expired' },
      { status: 401 },
    );
  }
}
