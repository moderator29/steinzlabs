import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin, getLivePrice, tokenKeyFor } from '@/lib/coins/coinService';
import { generateReferralCode } from '@/lib/referral/referralCode';

export const runtime = 'edge';

/**
 * Shareable position card (PNG). URL shape:
 *   /api/coins/position-card?chain=solana&address=<mint>&user=<username>
 *
 * Reads the user's real position in that coin from coin_trades (net tokens,
 * running-average cost basis, weighted entry market cap), values it at the live
 * price/mcap, and renders a branded card with their P&L. Real numbers only: a
 * user with no open position gets a clean "no position" card, missing params get
 * a 400. Deep-navy Naka look, brand-blue accents. Edge runtime + CDN cache so
 * repeated shares don't re-render.
 */

const BLUE = '#0066FF';
const UP = '#10B981';
const DOWN = '#F43F5E';
const NAVY_TOP = '#080b16';
const NAVY_BOT = '#0f1524';
const MUTED = '#8ea3c4';

function param(req: NextRequest, key: string): string {
  return (req.nextUrl.searchParams.get(key) ?? '').trim();
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs === 0) return '$0';
  return `$${n.toFixed(4)}`;
}

function fmtCompact(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface TradeRow {
  side: 'buy' | 'sell';
  usd_amount: number | string;
  token_amount: number | string;
  market_cap_usd: number | string | null;
}

function frame(children: React.ReactNode) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(135deg, ${NAVY_TOP} 0%, ${NAVY_BOT} 100%)`,
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: 64,
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}

function cardResponse(node: React.ReactElement, status = 200) {
  return new ImageResponse(node, {
    width: 1200,
    height: 630,
    status,
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600',
    },
  });
}

export async function GET(request: NextRequest) {
  const chain = param(request, 'chain');
  const address = param(request, 'address');
  const user = param(request, 'user').replace(/^@/, '');
  if (!chain || !address || !user) {
    return cardResponse(frame(<div style={{ display: 'flex', fontSize: 40 }}>Missing chain, address, or user</div>), 400);
  }

  const sb = getSupabaseAdmin();
  const { data: prof } = await sb
    .from('profiles')
    .select('id, username, display_name')
    .ilike('username', user)
    .maybeSingle();

  const handle = ((prof as { username?: string } | null)?.username) || user;
  const noPosition = (headline: string) =>
    cardResponse(
      frame(
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${BLUE},#0815B3)`, display: 'flex' }} />
            <div style={{ fontSize: 22, letterSpacing: 4, color: MUTED, display: 'flex' }}>NAKA LABS</div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 700, display: 'flex' }}>{headline}</div>
          </div>
          <div style={{ fontSize: 24, color: MUTED, display: 'flex' }}>nakalabs.xyz</div>
        </div>,
      ),
    );

  if (!prof) return noPosition('No Naka profile found');

  // Real position from the user's on-platform trades for this coin.
  const tokenKey = tokenKeyFor(chain, address);
  const { data: tradeData } = await sb
    .from('coin_trades')
    .select('side, usd_amount, token_amount, market_cap_usd, created_at')
    .eq('user_id', (prof as { id: string }).id)
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: true })
    .limit(5000);
  const rows = (tradeData as TradeRow[]) ?? [];

  // Running-average cost basis (matches the portfolio math) + entry market cap
  // weighted by USD bought.
  let net = 0;
  let costTokens = 0;
  let costUsd = 0;
  let entryMcapNumer = 0;
  let entryMcapDenom = 0;
  for (const r of rows) {
    const tok = Number(r.token_amount) || 0;
    const usd = Number(r.usd_amount) || 0;
    if (r.side === 'buy') {
      net += tok;
      costTokens += tok;
      costUsd += usd;
      const mc = r.market_cap_usd != null ? Number(r.market_cap_usd) : null;
      if (mc != null && mc > 0 && usd > 0) {
        entryMcapNumer += mc * usd;
        entryMcapDenom += usd;
      }
    } else {
      if (costTokens > 0) {
        const avg = costUsd / costTokens;
        const sold = Math.min(tok, costTokens);
        costTokens = Math.max(0, costTokens - tok);
        costUsd = Math.max(0, costUsd - sold * avg);
      }
      net -= tok;
    }
  }

  if (net <= 0.0000001) return noPosition(`@${handle} has no open position`);

  const [coin, live] = await Promise.all([
    resolveCoin(chain, address).catch(() => null),
    getLivePrice(chain, address).catch(() => null),
  ]);

  const price = live?.priceUsd ?? coin?.priceUsd ?? null;
  const currentMcap = live?.marketCapUsd ?? coin?.marketCapUsd ?? null;
  const symbol = (coin?.symbol || tokenKey.slice(0, 6)).toUpperCase();
  const logo = coin?.logoUrl ?? null;
  const entryMcap = entryMcapDenom > 0 ? entryMcapNumer / entryMcapDenom : null;

  const investedUsd = costUsd; // cost basis of the open position
  const currentValue = price != null ? net * price : null;
  const pnlUsd = currentValue != null ? currentValue - investedUsd : null;
  const pnlPct = pnlUsd != null && investedUsd > 0 ? (pnlUsd / investedUsd) * 100 : null;
  const up = (pnlUsd ?? 0) >= 0;
  const pnlColor = up ? UP : DOWN;

  const refCode = generateReferralCode((prof as { id: string }).id);
  const footer = refCode ? `nakalabs.xyz · ref ${refCode}` : 'nakalabs.xyz';

  const stat = (label: string, value: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 20, color: MUTED, letterSpacing: 1, display: 'flex' }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, display: 'flex' }}>{value}</div>
    </div>
  );

  return cardResponse(
    frame(
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header: brand + coin identity + handle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 999, border: `2px solid ${BLUE}` }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 999, background: `linear-gradient(135deg,${BLUE},#0815B3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800 }}>
                {symbol.slice(0, 1)}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, display: 'flex' }}>{symbol}</div>
              <div style={{ fontSize: 24, color: MUTED, display: 'flex' }}>@{handle}</div>
            </div>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 4, color: MUTED, display: 'flex' }}>NAKA LABS</div>
        </div>

        {/* Big P&L */}
        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 22, color: MUTED, letterSpacing: 2, display: 'flex' }}>UNREALIZED P&L</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
            <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, color: pnlColor, display: 'flex' }}>
              {pnlPct != null ? `${up ? '+' : ''}${pnlPct.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: pnlColor, display: 'flex' }}>
              {pnlUsd != null ? `${up ? '+' : '-'}${fmtUsd(Math.abs(pnlUsd))}` : '—'}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 44, display: 'flex', gap: 72 }}>
          {stat('Invested', fmtUsd(investedUsd))}
          {stat('Entry mcap', fmtCompact(entryMcap))}
          {stat('Current mcap', fmtCompact(currentMcap))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Accent rule + footer */}
        <div style={{ height: 4, width: 160, borderRadius: 999, background: BLUE, display: 'flex' }} />
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, color: MUTED, display: 'flex' }}>On-chain intelligence for every trade</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#fff', display: 'flex' }}>{footer}</div>
        </div>
      </div>,
    ),
  );
}
