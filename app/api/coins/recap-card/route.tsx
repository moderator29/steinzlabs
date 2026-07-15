import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateReferralCode } from '@/lib/referral/referralCode';
import { computeTradeRecap, isoWeekOf, isoWeekRange } from '@/lib/coins/recap';

export const runtime = 'edge';

/**
 * Shareable "Weekly recap" card (PNG). URL shape:
 *   /api/coins/recap-card?user=<username>&week=YYYY-Www
 *
 * Rolls the user's real coin_trades for one ISO week (default = the current UTC
 * week) into their realized PnL, best coin, trade count and win rate, then
 * renders a branded card. Real numbers only: a week with no trades gets a clean
 * "no trades" card, a user who hid their holdings gets a "private" card. Same
 * deep-navy Naka look, size and runtime as position-card, with a CDN cache so
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

function simpleCard(headline: string, sub: string, status = 200) {
  return cardResponse(
    frame(
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${BLUE},#0815B3)`, display: 'flex' }} />
          <div style={{ fontSize: 22, letterSpacing: 4, color: MUTED, display: 'flex' }}>NAKA LABS</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 52, fontWeight: 700, display: 'flex' }}>{headline}</div>
          {sub ? <div style={{ fontSize: 26, color: MUTED, display: 'flex' }}>{sub}</div> : null}
        </div>
        <div style={{ fontSize: 24, color: MUTED, display: 'flex' }}>nakalabs.xyz</div>
      </div>,
    ),
    status,
  );
}

export async function GET(request: NextRequest) {
  const user = param(request, 'user').replace(/^@/, '');
  if (!user) return simpleCard('Missing user', '', 400);

  const weekParam = param(request, 'week');
  const week = /^\d{4}-W\d{2}$/.test(weekParam) ? weekParam : isoWeekOf(new Date());
  const { startISO, endISO, label } = isoWeekRange(week);

  const sb = getSupabaseAdmin();
  const { data: prof } = await sb
    .from('profiles')
    .select('id, username, display_name, show_holdings')
    .ilike('username', user)
    .maybeSingle();

  const handle = ((prof as { username?: string } | null)?.username) || user;
  if (!prof) return simpleCard('No Naka profile found', `@${handle}`);

  // Same privacy gate as the profile holdings view / position-card.
  if ((prof as { show_holdings?: boolean }).show_holdings === false) {
    return simpleCard('This recap is private', `@${handle}`);
  }

  const recap = await computeTradeRecap((prof as { id: string }).id, startISO, endISO);
  if (recap.tradeCount === 0) return simpleCard('No trades this week', `@${handle} · ${label}`);

  const up = recap.realizedUsd >= 0;
  const pnlColor = up ? UP : DOWN;
  const refCode = generateReferralCode((prof as { id: string }).id);
  const footer = refCode ? `nakalabs.xyz · ref ${refCode}` : 'nakalabs.xyz';

  const stat = (labelText: string, value: string, color = '#fff') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 20, color: MUTED, letterSpacing: 1, display: 'flex' }}>{labelText}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color, display: 'flex' }}>{value}</div>
    </div>
  );

  const best = recap.best;

  return cardResponse(
    frame(
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, display: 'flex' }}>Weekly recap</div>
            <div style={{ fontSize: 24, color: MUTED, display: 'flex' }}>@{handle} · {label}</div>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 4, color: MUTED, display: 'flex' }}>NAKA LABS</div>
        </div>

        {/* Big realized PnL */}
        <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 22, color: MUTED, letterSpacing: 2, display: 'flex' }}>REALIZED P&L</div>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, color: pnlColor, display: 'flex' }}>
            {`${up ? '+' : '-'}${fmtUsd(Math.abs(recap.realizedUsd))}`}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 40, display: 'flex', gap: 64, flexWrap: 'wrap' }}>
          {stat('Best coin', best ? `${(best.symbol || best.tokenKey.slice(0, 6)).toUpperCase()} ${best.pnlUsd >= 0 ? '+' : '-'}${fmtUsd(Math.abs(best.pnlUsd))}` : '—', best ? UP : '#fff')}
          {stat('Trades', String(recap.tradeCount))}
          {stat('Win rate', recap.winRatePct != null ? `${recap.winRatePct.toFixed(0)}%` : '—')}
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
