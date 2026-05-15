import { NextResponse } from 'next/server';
import { getTopGainers, type CoinGeckoMarketToken } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

async function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try { return await Promise.race([p, t]); } finally { if (timer) clearTimeout(timer); }
}

// Audit M6 #2 — $1M market cap floor. Without this the list was
// dominated by sub-$1M micro-caps with absurd 1000% moves that no
// real trader would touch. CoinMarketCap / Birdeye apply the same
// floor on their public movers panels.
const MIN_MARKET_CAP_USD = 1_000_000;

type Direction = 'gainers' | 'losers';
type Timeframe = '1h' | '24h' | '7d';

function pctFor(t: CoinGeckoMarketToken, tf: Timeframe): number {
  if (tf === '1h') return Number(t.price_change_percentage_1h_in_currency ?? 0);
  if (tf === '7d') return Number(t.price_change_percentage_7d_in_currency ?? 0);
  return Number(t.price_change_percentage_24h ?? 0);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '8', 10) || 8, 1), 50);
  // Audit M6 #4 — losers tab. CMC / CoinGecko / Birdeye all expose
  // gainers + losers as a paired view; we now do too. Same data,
  // sorted opposite direction.
  const direction: Direction = (searchParams.get('direction') === 'losers') ? 'losers' : 'gainers';
  // Audit M6 #3 — timeframe pills (1h / 24h / 7d). Same upstream
  // /coins/markets payload already carries all three percentages
  // (price_change_percentage=1h,24h,7d), we just sort against the
  // requested one server-side so the client doesn't paginate
  // wrongly.
  const tfRaw = searchParams.get('timeframe');
  const tf: Timeframe = (tfRaw === '1h' || tfRaw === '7d') ? tfRaw : '24h';

  try {
    // Pull a wider universe so the MC floor + direction filter still
    // leaves us with `limit` rows.
    const universe = await withDeadline<CoinGeckoMarketToken[]>(getTopGainers(Math.max(limit * 5, 50)), 8000, []);
    const filtered = universe
      .filter((t) => Number(t.market_cap ?? 0) >= MIN_MARKET_CAP_USD)
      .filter((t) => {
        const p = pctFor(t, tf);
        return direction === 'gainers' ? p > 0 : p < 0;
      })
      .sort((a, b) => {
        const pa = pctFor(a, tf);
        const pb = pctFor(b, tf);
        return direction === 'gainers' ? pb - pa : pa - pb;
      })
      .slice(0, limit);
    return NextResponse.json({ tokens: filtered, direction, timeframe: tf }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  } catch (err) {
    console.error('[dashboard/top-gainers]', err);
    return NextResponse.json({ tokens: [], direction, timeframe: tf }, { status: 502 });
  }
}
