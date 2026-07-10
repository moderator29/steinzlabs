import { NextResponse } from 'next/server';
import { goldrushEnabled, goldrushSupportsChain, getTokenOhlcv } from '@/lib/services/goldrush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

/**
 * GET /api/market/ohlcv?chain=<id>&address=<token>&days=<n>
 *
 * Real token OHLCV-style series from GoldRush (Covalent). OPTIONAL provider:
 * when COVALENT_API_KEY / GOLDRUSH_API_KEY is unset — or the chain isn't mapped,
 * or GoldRush has no data — this returns an HONEST empty series
 * ({ candles: [], available: false, ... }) with HTTP 200 so consumers can
 * degrade to their own source instead of erroring. Never fabricates candles.
 *
 * Series semantics (documented in lib/services/goldrush.ts getTokenOhlcv): the
 * GoldRush token-address pricing endpoint supplies daily CLOSE prices only, so
 * open/high/low are derived from adjacent REAL closes and volume is null.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chain = (searchParams.get('chain') || '').toLowerCase().trim();
  const address = (searchParams.get('address') || searchParams.get('token') || '').trim();
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365);

  if (!chain || !address) {
    return NextResponse.json(
      { available: false, reason: 'missing_params', note: 'chain and address are required', candles: [] },
      { status: 400 },
    );
  }

  const base = { chain, address, days, source: 'goldrush' as const };

  if (!goldrushEnabled()) {
    return NextResponse.json({
      ...base,
      available: false,
      reason: 'goldrush_unconfigured',
      note: 'GoldRush key not set — no OHLCV from this provider. Fall back to your own source.',
      candles: [],
    });
  }

  if (!goldrushSupportsChain(chain)) {
    return NextResponse.json({
      ...base,
      available: false,
      reason: 'chain_unsupported',
      note: `No verified GoldRush chain mapping for "${chain}".`,
      candles: [],
    });
  }

  try {
    const candles = await getTokenOhlcv(chain, address, { days });
    return NextResponse.json({
      ...base,
      available: candles.length > 0,
      reason: candles.length > 0 ? 'ok' : 'no_data',
      volume_available: false, // GoldRush pricing endpoint does not supply per-token volume
      count: candles.length,
      candles,
    });
  } catch {
    return NextResponse.json({
      ...base,
      available: false,
      reason: 'provider_error',
      candles: [],
    });
  }
}
