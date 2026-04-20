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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '8', 10) || 8, 1), 50);
  try {
    const gainers = await withDeadline<CoinGeckoMarketToken[]>(getTopGainers(limit), 8000, []);
    return NextResponse.json({ tokens: gainers }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  } catch (err) {
    console.error('[dashboard/top-gainers]', err);
    return NextResponse.json({ tokens: [] }, { status: 502 });
  }
}
