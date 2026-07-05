import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 60;

// Depeg Radar — live peg-deviation monitor for major USD stablecoins. Real
// prices from CoinGecko; deviation is measured against the $1.00 peg. No
// fabricated data — a source outage returns an honest empty list.

const BASKET: Array<{ id: string; symbol: string; name: string }> = [
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'dai', symbol: 'DAI', name: 'Dai' },
  { id: 'first-digital-usd', symbol: 'FDUSD', name: 'First Digital USD' },
  { id: 'ethena-usde', symbol: 'USDe', name: 'Ethena USDe' },
  { id: 'usdd', symbol: 'USDD', name: 'USDD' },
  { id: 'paypal-usd', symbol: 'PYUSD', name: 'PayPal USD' },
  { id: 'frax', symbol: 'FRAX', name: 'Frax' },
  { id: 'true-usd', symbol: 'TUSD', name: 'TrueUSD' },
  { id: 'liquity-usd', symbol: 'LUSD', name: 'Liquity USD' },
  { id: 'crvusd', symbol: 'crvUSD', name: 'Curve USD' },
  { id: 'gemini-dollar', symbol: 'GUSD', name: 'Gemini Dollar' },
];

function status(devBps: number): 'stable' | 'watch' | 'depeg' {
  const a = Math.abs(devBps);
  if (a >= 100) return 'depeg';   // >=1%
  if (a >= 30) return 'watch';    // >=0.3%
  return 'stable';
}

export async function GET() {
  try {
    const ids = BASKET.map((b) => b.id).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: process.env.COINGECKO_API_KEY ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY } : {},
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return NextResponse.json({ pegs: [], error: 'source_unavailable', timestamp: Date.now() });
    const body = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;

    const pegs = BASKET.map((b) => {
      const price = typeof body[b.id]?.usd === 'number' ? body[b.id]!.usd! : null;
      const devBps = price != null ? Math.round((price - 1) * 10000) : null;
      return {
        symbol: b.symbol,
        name: b.name,
        price,
        deviationBps: devBps,
        change24hPct: typeof body[b.id]?.usd_24h_change === 'number' ? Number(body[b.id]!.usd_24h_change!.toFixed(3)) : null,
        status: devBps != null ? status(devBps) : null,
      };
    })
      .filter((p) => p.price != null)
      .sort((a, b) => Math.abs(b.deviationBps ?? 0) - Math.abs(a.deviationBps ?? 0));

    return NextResponse.json({ pegs, timestamp: Date.now() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ pegs: [], error: 'failed', timestamp: Date.now() }, { status: 502 });
  }
}
