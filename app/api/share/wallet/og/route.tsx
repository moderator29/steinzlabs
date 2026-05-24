import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * WI5: Open Graph card image for a wallet share link. Reads the JWT
 * minted by POST /api/share/wallet and renders a 1200×630 PNG that
 * Telegram / Twitter / Discord can fetch when the share URL is pasted.
 *
 * No external font dependency — Vercel's default fonts ship in
 * @vercel/og, and ImageResponse from next/og uses them automatically.
 */

export const runtime = 'edge';

function secret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('JWT_SECRET or SESSION_SECRET required');
  return new TextEncoder().encode(s);
}

function shortAddress(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get('t');
  let address = 'Unknown wallet';
  let chain = '—';
  if (t) {
    try {
      const { payload } = await jwtVerify(t, secret());
      if (typeof payload.address === 'string') address = payload.address;
      if (typeof payload.chain === 'string') chain = payload.chain;
    } catch { /* fall through with default labels */ }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'linear-gradient(135deg, #05081E 0%, #0A1438 50%, #0A1EFF 100%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#0A1EFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Naka Labs · Wallet Intelligence</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 24, color: '#8FA3FF', textTransform: 'uppercase', letterSpacing: 2 }}>
            {chain.toUpperCase()} wallet
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, fontFamily: 'monospace', letterSpacing: -1 }}>
            {shortAddress(address)}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 20, color: '#94A3B8' }}>
          <span>Tap to view live holdings, alpha report, and risk graph.</span>
          <span>nakalabs.xyz</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
