import { NextResponse } from 'next/server';
import { getTopGainers, type CoinGeckoMarketToken } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const MIN_MARKET_CAP = 1_000_000; // $1M floor — avoid micro-caps masquerading as "gainers"

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
    // Bug §6.1 — testers reported the card showing top-market-cap tokens
    // instead of actual gainers. CoinGecko's free tier sometimes returns
    // unsorted results, and even when ordering works the unfiltered output
    // is dominated by sub-$1M micro-caps with absurd % moves. We over-fetch
    // (3x requested + 10 headroom), filter out negative/flat coins and any
    // sub-$1M market cap, then slice to the requested limit. This produces
    // a stable "real gainers" list across CoinGecko response variations.
    const overFetch = Math.min(50, limit * 3 + 10);
    const raw = await withDeadline<CoinGeckoMarketToken[]>(getTopGainers(overFetch), 8000, []);
    const gainers = raw
      .filter(t => typeof t.price_change_percentage_24h === 'number' && t.price_change_percentage_24h > 0)
      .filter(t => typeof t.market_cap === 'number' && t.market_cap >= MIN_MARKET_CAP)
      .sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0))
      .slice(0, limit);
    return NextResponse.json({ tokens: gainers }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  } catch (err) {
    console.error('[dashboard/top-gainers]', err);
    return NextResponse.json({ tokens: [], direction, timeframe: tf }, { status: 502 });
  }
}
