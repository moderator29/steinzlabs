import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

/**
 * BUBBLE4: signed permalink for a bubble-map view.
 *
 * POST  { token, chain, mode, at } → { url, token }
 * GET   ?t=<jwt> → { token, chain, mode, at } (verifies + returns the
 *                  decoded payload so the client can redirect to the
 *                  bubble-map page with pre-filled state)
 *
 * The JWT is signed with JWT_SECRET so a forged URL can't trick the
 * page into pointing at a different token/timestamp than the sender
 * actually shared.
 */

export const runtime = 'nodejs';

function secret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('JWT_SECRET or SESSION_SECRET required for bubble-map share signing');
  return new TextEncoder().encode(s);
}

const VALID_MODES = new Set(['holders', 'network', 'clusters']);

interface SharePayload {
  token: string;
  chain: string;
  mode: 'holders' | 'network' | 'clusters';
  at: number | null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Partial<SharePayload> | null;
  if (!body || typeof body.token !== 'string' || typeof body.chain !== 'string') {
    return NextResponse.json({ error: 'token and chain are required' }, { status: 400 });
  }
  const mode = (body.mode && VALID_MODES.has(body.mode) ? body.mode : 'holders') as SharePayload['mode'];
  const at = typeof body.at === 'number' && Number.isFinite(body.at) ? body.at : null;

  const token = await new SignJWT({ token: body.token, chain: body.chain, mode, at })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    url: `${origin}/dashboard/bubble-map?share=${encodeURIComponent(token)}`,
    token,
  });
}

export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get('t');
  if (!t) return NextResponse.json({ error: 't required' }, { status: 400 });
  try {
    const { payload } = await jwtVerify(t, secret());
    return NextResponse.json({
      token: payload.token,
      chain: payload.chain,
      mode: payload.mode,
      at: payload.at ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid or expired share token' }, { status: 400 });
  }
}
