import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = process.env.COINGECKO_API_KEY
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3';

function cgHeaders() {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-pro-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = searchParams.get('page') ?? '1';
  const category = searchParams.get('category') ?? '';

  const params = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '100',
    page,
    sparkline: 'true',
    price_change_percentage: '1h,24h,7d',
  });

  if (category && category !== 'all') {
    const catMap: Record<string, string> = {
      defi: 'decentralized-finance-defi',
      depin: 'depin',
      cults: 'meme-token',
    };
    if (catMap[category]) params.set('category', catMap[category]);
  }

  try {
    const res = await fetch(`${BASE}/coins/markets?${params}`, {
      headers: cgHeaders(),
      next: { revalidate: 60 },
    } as RequestInit);

    if (!res.ok) {
      // Fallback to public if pro 429
      if (res.status === 429 && process.env.COINGECKO_API_KEY) {
        const pub = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`, {
          next: { revalidate: 60 },
        });
        const data = await pub.json();
        return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=60' } });
      }
      return NextResponse.json({ error: `CoinGecko error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
