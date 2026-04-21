import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getBestPair } from '@/lib/services/dexscreener';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.coingecko.com/api/v3';

function cgHeaders() {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

/**
 * §4.6 — fall back to DexScreener when CoinGecko doesn't index the
 * token. Without this, the coin detail page for small community tokens
 * like Naka Go (0x6967…2898) and Pleasure Coin (0x8f00…bf19) breaks
 * because CoinGecko returns 404. DexScreener covers any contract that
 * has an on-chain DEX pair.
 *
 * Response is reshaped to match the CoinGecko structure the UI consumes
 * so hooks + components don't branch on data source.
 */
async function dexscreenerFallback(contract: string) {
  const pair = await getBestPair(contract);
  if (!pair) return null;

  const priceUsd = parseFloat(pair.priceUsd) || 0;
  const change24h = pair.priceChange?.h24 ?? 0;
  const change1h = pair.priceChange?.h1 ?? 0;
  const change24hAbs = (change24h / 100) * priceUsd;

  return {
    id: contract.toLowerCase(),
    symbol: pair.baseToken.symbol.toLowerCase(),
    name: pair.baseToken.name,
    image: {
      thumb: pair.info?.imageUrl ?? '',
      small: pair.info?.imageUrl ?? '',
      large: pair.info?.imageUrl ?? '',
    },
    market_data: {
      current_price: { usd: priceUsd },
      market_cap: { usd: pair.marketCap ?? 0 },
      fully_diluted_valuation: { usd: pair.fdv ?? 0 },
      total_volume: { usd: pair.volume?.h24 ?? 0 },
      high_24h: { usd: 0 },
      low_24h: { usd: 0 },
      price_change_percentage_24h: change24h,
      price_change_percentage_7d: 0,
      price_change_percentage_30d: 0,
      price_change_percentage_1h_in_currency: { usd: change1h },
      price_change_24h: change24hAbs,
      circulating_supply: 0,
      total_supply: 0,
      max_supply: 0,
    },
    description: {
      en: `${pair.baseToken.name} (${pair.baseToken.symbol}) — trading on ${pair.dexId} via ${pair.chainId}. Data sourced from DexScreener.`,
    },
    _source: 'dexscreener',
    _dex: {
      volume_m5: pair.volume?.m5 ?? 0,
      volume_h24: pair.volume?.h24 ?? 0,
      buys_h24: pair.txns?.h24?.buys ?? 0,
      sells_h24: pair.txns?.h24?.sells ?? 0,
    },
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // EVM contract shape → go straight to DexScreener; CoinGecko's
  // /coins/:id only accepts slugs (bitcoin, ethereum). Avoids a
  // guaranteed 404 round-trip.
  const looksLikeEvmContract = /^0x[0-9a-fA-F]{40}$/.test(id);

  if (!looksLikeEvmContract) {
    const url = new URL(`${BASE}/coins/${id}`);
    url.searchParams.set('localization', 'false');
    url.searchParams.set('tickers', 'false');
    url.searchParams.set('market_data', 'true');
    url.searchParams.set('community_data', 'false');
    url.searchParams.set('developer_data', 'false');
    url.searchParams.set('sparkline', 'true');

    try {
      const res = await fetch(url.toString(), { headers: cgHeaders(), next: { revalidate: 120 } } as RequestInit);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=120' } });
      }
    } catch { /* fall through to DexScreener */ }
  }

  // Fallback path — DexScreener by contract address.
  try {
    const data = await dexscreenerFallback(id);
    if (!data) return NextResponse.json({ error: 'Token not found on any data source' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
