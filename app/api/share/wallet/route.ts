import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * WI5: signed share permalink for a wallet-intelligence view.
 *
 * POST { address, chain } → { url, token }
 * GET  ?t=<jwt>           → { address, chain }
 *
 * Uses the existing JWT_SECRET / SESSION_SECRET so a recipient can
 * trust that the wallet/chain pair they're being shown wasn't tampered
 * with in transit. 30-day expiry — long enough for casual share links,
 * short enough that a leaked link doesn't outlive the user's interest.
 */

export const runtime = 'nodejs';

function secret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('JWT_SECRET or SESSION_SECRET required for wallet share signing');
  return new TextEncoder().encode(s);
}

const VALID_CHAINS = new Set(['ethereum', 'solana', 'bsc', 'base', 'arbitrum', 'polygon', 'optimism', 'avalanche']);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { address?: string; chain?: string } | null;
  if (!body?.address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const chain = (body.chain ?? 'ethereum').toLowerCase();
  if (!VALID_CHAINS.has(chain)) return NextResponse.json({ error: 'unsupported chain' }, { status: 400 });

  const normalized = normalizeAddress(body.address);
  if (!normalized) return NextResponse.json({ error: 'invalid address' }, { status: 400 });

  const token = await new SignJWT({ address: normalized, chain })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    url: `${origin}/dashboard/wallet-intelligence/${normalized}?chain=${chain}&share=${encodeURIComponent(token)}`,
    ogImage: `${origin}/api/share/wallet/og?t=${encodeURIComponent(token)}`,
    token,
  });
}

export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get('t');
  if (!t) return NextResponse.json({ error: 't required' }, { status: 400 });
  try {
    const { payload } = await jwtVerify(t, secret());
    return NextResponse.json({ address: payload.address, chain: payload.chain });
  } catch {
    return NextResponse.json({ error: 'Invalid or expired share token' }, { status: 400 });
  }
}
