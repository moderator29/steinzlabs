import { NextRequest, NextResponse } from 'next/server';
import { getSpot, TRACKED_SYMBOLS } from '@/lib/predict/priceFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/predict/price?symbols=SOL,ETH
 * -> { prices: { symbol, price, series }[] }
 * Live spot + recent series for client polling. Real prices only.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('symbols');
    const symbols = raw
      ? raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : TRACKED_SYMBOLS;

    const spots = await getSpot(symbols);
    const prices = spots.map((s) => ({
      symbol: s.symbol,
      price: s.price,
      series: s.series,
    }));

    return NextResponse.json(
      { prices },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ prices: [], error: msg }, { status: 500 });
  }
}
