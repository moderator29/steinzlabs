import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

// FIX 5A.1 / Phase 4: 7-day price sparkline for the wallet coin list.
// Backed by CoinGecko market_chart. Cached edge-side to stay under free-tier rate limits.

export const runtime = 'nodejs';

const CACHE_TTL_SEC = 300;
type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

// Synthesize a short 7-day line from DexScreener priceChange buckets. Used
// as a fallback for tokens CoinGecko doesn't index (Naka Go, Pleasure Coin,
// any contract the user pastes as a custom token). Not true OHLC but the
// direction + magnitude of the line reflects real 1h / 6h / 24h moves so
// the wallet sparkline stops reading as a blank strip for small-caps.
async function dexSparkline(contract: string, chain: string | null) {
  const r = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(contract)}`,
    { next: { revalidate: 60 } },
  );
  if (!r.ok) return { points: [], changePct: 0 };
  const body = await r.json();
  const pair = Array.isArray(body?.pairs)
    ? body.pairs
        .filter((p: { chainId?: string }) => !chain || p.chainId === chain)
        .sort(
          (a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) =>
            (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
        )[0]
    : null;
  if (!pair) return { points: [], changePct: 0 };
  const price = parseFloat(pair.priceUsd || '0');
  const c = pair.priceChange || {};
  if (!price) return { points: [], changePct: 0 };
  const samples = [
    { pct: typeof c.h24 === 'number' ? c.h24 * 2 : undefined },
    { pct: c.h24 },
    { pct: c.h6 },
    { pct: c.h1 },
  ].filter((s) => typeof s.pct === 'number');
  const points: number[] = [];
  for (const s of samples) points.push(price / (1 + (s.pct as number) / 100));
  points.push(price);
  const first = points[0];
  const last = points[points.length - 1];
  return { points, changePct: first ? ((last - first) / first) * 100 : 0 };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const contract = request.nextUrl.searchParams.get('contract');
  const chain = request.nextUrl.searchParams.get('chain');

  // Contract path — any EVM/SPL token the user holds but CoinGecko doesn't
  // index. Takes precedence over id so Naka Go / Pleasure Coin rows always
  // render a live line instead of falling through to the generic CG lookup.
  if (contract && /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(contract)) {
    const ckey = `spark:dex:${chain || ''}:${contract.toLowerCase()}`;
    const hit = cache.get(ckey);
    if (hit && Date.now() - hit.at < CACHE_TTL_SEC * 1000) {
      return NextResponse.json(hit.data, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
      });
    }
    try {
      const data = await dexSparkline(contract, chain);
      cache.set(ckey, { at: Date.now(), data });
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
      });
    } catch {
      return NextResponse.json({ points: [], changePct: 0 }, { status: 200 });
    }
  }

  if (!id) return NextResponse.json({ error: 'missing id or contract' }, { status: 400 });

  const key = `sparkline:${id}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_SEC * 1000) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
    });
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=7`,
      {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-pro-api-key': process.env.COINGECKO_API_KEY }
          : {},
        next: { revalidate: CACHE_TTL_SEC },
      },
    );
    if (!res.ok) throw new Error(`cg ${res.status}`);
    const raw = (await res.json()) as { prices: Array<[number, number]> };
    // Downsample to ~48 points to keep the sparkline cheap.
    const prices = raw.prices.map((p) => p[1]);
    const step = Math.max(1, Math.floor(prices.length / 48));
    const points = prices.filter((_, i) => i % step === 0);
    const first = points[0] ?? 0;
    const last = points[points.length - 1] ?? 0;
    const changePct = first ? ((last - first) / first) * 100 : 0;
    const data = { points, changePct };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
    });
  } catch {
    return NextResponse.json({ points: [], changePct: 0 }, { status: 200 });
  }
}
