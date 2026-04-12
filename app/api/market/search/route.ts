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
  const query = req.nextUrl.searchParams.get('q') ?? '';
  if (!query.trim()) return NextResponse.json({ coins: [] });

  try {
    const res = await fetch(`${BASE}/search?query=${encodeURIComponent(query)}`, {
      headers: cgHeaders(),
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `CoinGecko ${res.status}` }, { status: res.status });
    }

    const data = await res.json() as {
      coins: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[];
    };

    return NextResponse.json({ coins: (data.coins ?? []).slice(0, 20) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
