import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStockRowsResilient } from '@/lib/services/pythStocks';
import { getUniverse, getTickerStripSymbols, nameMapFor, type StockTab } from '@/lib/services/stockUniverse';

/**
 * Stocks list + top ticker strip.
 * GET /api/markets/stocks?tab=stocks|rwa|ai&all=0|1
 *
 * Real prices, change % and sparklines from Yahoo Finance (keyless). Returns the
 * rows for the requested tab plus the shared ticker-strip movers. Honest empty
 * rows[] when Yahoo is unreachable — never fabricated numbers.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; body: unknown }>();

const VALID_TABS: StockTab[] = ['stocks', 'rwa', 'ai'];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tab');
  // Whitelist the tab so the cache keyspace stays bounded (a loop of unique
  // ?tab= values can't grow the module-level Map without limit).
  const tab: StockTab = VALID_TABS.includes(raw as StockTab) ? (raw as StockTab) : 'stocks';
  const all = req.nextUrl.searchParams.get('all') === '1';
  const key = `${tab}:${all ? 'all' : 'marquee'}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.body, { status: 200 });
  }

  const defs = getUniverse(tab, all);
  const stripDefs = getTickerStripSymbols();
  const allDefs = [...defs, ...stripDefs];
  const nameMap = nameMapFor(allDefs);

  const symbols = Array.from(new Set(allDefs.map((d) => d.symbol)));
  const rows = await getStockRowsResilient(symbols, nameMap);
  const bySym = new Map(rows.map((r) => [r.symbol, r]));

  const list = defs.map((d) => bySym.get(d.symbol)).filter(Boolean);
  const strip = stripDefs.map((d) => bySym.get(d.symbol)).filter(Boolean);

  const body = {
    available: list.length > 0,
    tab,
    all,
    asOf: new Date().toISOString(),
    source: 'yahoo',
    rows: list,
    ticker: strip,
  };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body, { status: 200 });
}
