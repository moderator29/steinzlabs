import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * Per-token Open Graph image. URL shape:
 *   /api/og/token?symbol=PEPE&price=0.00001234&change=12.4&trust=78
 *
 * Audit §5.9 B.18 — every token detail page should ship a
 * symbol-specific OG card so Twitter / Discord / Telegram unfurls
 * render the live token data instead of a generic platform card.
 * Edge runtime so it cold-starts fast; cached 5 minutes at the
 * CDN edge so repeated unfurls don't burn render time.
 */

function param(req: NextRequest, key: string, fallback = ''): string {
  return req.nextUrl.searchParams.get(key) ?? fallback;
}

function fmtPrice(raw: string): string {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return '$0';
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function trustColor(score: number): string {
  if (score >= 70) return '#10B981';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function trustLabel(score: number): string {
  if (score >= 70) return 'TRUSTED';
  if (score >= 40) return 'CAUTION';
  return 'DANGER';
}

export async function GET(request: NextRequest) {
  const symbol = (param(request, 'symbol', 'TOKEN') || 'TOKEN').slice(0, 12).toUpperCase();
  const price = fmtPrice(param(request, 'price', '0'));
  const changeRaw = parseFloat(param(request, 'change', '0'));
  const change = Number.isFinite(changeRaw) ? changeRaw : 0;
  const trustRaw = parseFloat(param(request, 'trust', '0'));
  const trust = Number.isFinite(trustRaw) ? Math.max(0, Math.min(100, Math.round(trustRaw))) : 0;
  const isUp = change >= 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: 64,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg,#0A1EFF,#0815B3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            🛡
          </div>
          <div style={{ fontSize: 22, letterSpacing: 4, color: '#94a3b8', display: 'flex' }}>NAKA LABS</div>
        </div>

        <div style={{ marginTop: 60, display: 'flex', alignItems: 'baseline', gap: 24 }}>
          <div style={{ fontSize: 100, fontWeight: 800, letterSpacing: -2, display: 'flex' }}>{symbol}</div>
          <div style={{ fontSize: 56, fontWeight: 700, fontFamily: 'monospace', display: 'flex' }}>{price}</div>
        </div>

        <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: isUp ? '#10B981' : '#EF4444',
              display: 'flex',
            }}
          >
            {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}% 24h
          </div>
          <div
            style={{
              fontSize: 24,
              padding: '8px 20px',
              borderRadius: 999,
              border: `2px solid ${trustColor(trust)}`,
              color: trustColor(trust),
              fontWeight: 700,
              letterSpacing: 1,
              display: 'flex',
            }}
          >
            TRUST {trust}/100 · {trustLabel(trust)}
          </div>
        </div>

        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 22,
            color: '#94a3b8',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex' }}>On-chain intelligence for every trade</div>
          <div style={{ display: 'flex' }}>nakalabs.xyz</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      },
    },
  );
}
