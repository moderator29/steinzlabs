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

// Map our category IDs → CoinGecko category slugs
const CAT_MAP: Record<string, string> = {
  defi:         'decentralized-finance-defi',
  layer1:       'layer-1',
  layer2:       'layer-2',
  gaming:       'gaming',
  meme:         'meme-token',
  ai:           'artificial-intelligence',
  depin:        'depin',
};

async function cgFetch(url: string, hdrs: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: hdrs,
      signal: controller.signal,
      next: { revalidate: 60 },
    } as RequestInit);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page     = searchParams.get('page')     ?? '1';
  const category = searchParams.get('category') ?? 'all';

  const params = new URLSearchParams({
    vs_currency:              'usd',
    order:                    'market_cap_desc',
    per_page:                 '100',
    page,
    sparkline:                'true',
    price_change_percentage:  '1h,24h,7d',
  });

  if (category && category !== 'all' && category !== 'majors') {
    const slug = CAT_MAP[category];
    if (slug) params.set('category', slug);
  }

  try {
    const res = await cgFetch(`${BASE}/coins/markets?${params}`, cgHeaders());

    if (!res.ok) {
      // Rate-limited on pro key → retry on free
      if (res.status === 429 && process.env.COINGECKO_API_KEY) {
        try {
          const fallback = await cgFetch(
            `https://api.coingecko.com/api/v3/coins/markets?${params}`
          );
          if (fallback.ok) {
            const data = await fallback.json();
            return NextResponse.json(data, {
              headers: { 'Cache-Control': 'public, max-age=60' },
            });
          }
        } catch { /* fall through */ }
      }
      return NextResponse.json(
        { error: `Market data unavailable (${res.status}). Please retry in a moment.` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch market data';
    const isTimeout = msg.includes('abort') || msg.includes('signal');
    return NextResponse.json(
      { error: isTimeout ? 'Request timed out — please retry.' : msg },
      { status: 503 }
    );
  }
}
