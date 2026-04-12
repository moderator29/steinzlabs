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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const url = new URL(`${BASE}/coins/${id}`);
  url.searchParams.set('localization', 'false');
  url.searchParams.set('tickers', 'false');
  url.searchParams.set('market_data', 'true');
  url.searchParams.set('community_data', 'false');
  url.searchParams.set('developer_data', 'false');
  url.searchParams.set('sparkline', 'true');

  try {
    const res = await fetch(url.toString(), {
      headers: cgHeaders(),
      next: { revalidate: 120 },
    } as RequestInit);

    if (!res.ok) {
      return NextResponse.json({ error: `CoinGecko error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
