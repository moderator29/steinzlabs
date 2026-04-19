import { NextResponse } from 'next/server';
import { getTokenPriceDetailed } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lightweight batch-price endpoint used by the alert-monitor poll loop and
// any other client surface that needs many token prices in one shot. Wraps
// the unified service so calls share the cache + usage counter.
//
//   GET /api/prices/batch?ids=bitcoin,ethereum,solana
//   -> { prices: { bitcoin: {price, change24h}, ethereum: {...}, ... } }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsRaw = searchParams.get('ids') || '';
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ prices: {} });
  try {
    const prices = await getTokenPriceDetailed(ids);
    return NextResponse.json({ prices });
  } catch (err) {
    console.error('[prices/batch]', err);
    return NextResponse.json({ prices: {} }, { status: 502 });
  }
}
