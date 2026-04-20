import { NextResponse } from 'next/server';
import { getContractPrice, getTokenPriceDetailed } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// Map common native/quote symbols to CoinGecko IDs so we can price tokens
// that don't have an on-chain contract address (ETH, SOL, etc.).
const SYMBOL_TO_CG_ID: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  SOL: 'solana',
  BNB: 'binancecoin',
  MATIC: 'matic-network',
  POL: 'matic-network',
  AVAX: 'avalanche-2',
  ARB: 'arbitrum',
  OP: 'optimism',
  TRX: 'tron',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
};

interface InputToken { address?: string | null; chain?: string | null; symbol: string }

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { tokens?: InputToken[] };
    const tokens = Array.isArray(body.tokens) ? body.tokens.slice(0, 50) : [];
    if (!tokens.length) return NextResponse.json({ prices: {} });

    // Build two parallel pools: symbol-based (for well-known tokens) and contract-based.
    const symbolIds: string[] = [];
    const symbolToKey: Record<string, string> = {};
    const contractJobs: Array<{ key: string; address: string; chain: string }> = [];

    for (const t of tokens) {
      const key = (t.address?.toLowerCase()) || t.symbol.toUpperCase();
      const cgId = SYMBOL_TO_CG_ID[t.symbol.toUpperCase()];
      if (cgId) {
        symbolIds.push(cgId);
        symbolToKey[cgId] = key;
        continue;
      }
      if (t.address && t.chain) {
        contractJobs.push({ key, address: t.address, chain: t.chain });
      }
    }

    const [bySymbolDetailed, contractResults] = await Promise.all([
      symbolIds.length ? safe(getTokenPriceDetailed(symbolIds), {} as Record<string, { price: number; change24h: number }>) : Promise.resolve({} as Record<string, { price: number; change24h: number }>),
      Promise.all(contractJobs.map(async j => ({
        key: j.key,
        price: await safe(getContractPrice(j.address, j.chain), 0),
      }))),
    ]);

    const out: Record<string, { price: number; change24h: number }> = {};
    for (const [cgId, row] of Object.entries(bySymbolDetailed)) {
      const k = symbolToKey[cgId];
      if (k) out[k] = { price: row.price, change24h: row.change24h };
    }
    for (const r of contractResults) {
      if (!out[r.key]) out[r.key] = { price: r.price, change24h: 0 };
    }

    return NextResponse.json({ prices: out }, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
    });
  } catch (err) {
    console.error('[portfolio/live-prices]', err);
    return NextResponse.json({ prices: {} }, { status: 502 });
  }
}
