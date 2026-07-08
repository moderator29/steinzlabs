import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getBestPair } from '@/lib/services/dexscreener';
import { COMMUNITY_TOKEN_CONTRACTS, SYMBOL_TO_SLUG } from '@/lib/market/tokenIdMaps';
import { headlineMarketCap, clampFdv } from '@/lib/market/headline';

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

  // Same headline-market-cap convention the token card + agent use
  // (lib/market/headline.ts): for long-tail tokens DexScreener's circulating
  // marketCap is unreliable, so the FDV is headlined when it exceeds it. Using
  // the raw pair.marketCap here made the coin-detail page disagree with the
  // token card for the same token (card said $267M, detail said $116M).
  const marketCap = headlineMarketCap(pair.fdv, pair.marketCap);
  const fdv = clampFdv(pair.fdv ?? pair.marketCap, marketCap);

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
      market_cap: { usd: marketCap },
      fully_diluted_valuation: { usd: fdv },
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
      volume_h1: pair.volume?.h1 ?? 0,
      volume_h6: pair.volume?.h6 ?? 0,
      volume_h24: pair.volume?.h24 ?? 0,
      buys_h24: pair.txns?.h24?.buys ?? 0,
      sells_h24: pair.txns?.h24?.sells ?? 0,
      // Audit P1 #17 — DexScreener-parity full tier strip on the
      // detail-page header. CoinGecko's price endpoint exposes only 1h
      // and 24h percentages; DexScreener tracks m5/h1/h6/h24 per pair,
      // which is what serious traders use to read momentum.
      change_m5: pair.priceChange?.m5 ?? null,
      change_h1: pair.priceChange?.h1 ?? null,
      change_h6: pair.priceChange?.h6 ?? null,
      change_h24: pair.priceChange?.h24 ?? null,
      // Audit P1 #20 — needed so the chart for off-CEX tokens (Naka Go,
      // Pleasure Coin, every long-tail) can render against the actual
      // DEX pair instead of the broken BINANCE:{SYM}USDT fallback.
      pair_address: pair.pairAddress,
      pair_chain_id: pair.chainId,
      dex_id: pair.dexId,
      liquidity_usd: pair.liquidity?.usd ?? null,
    },
  };
}

// Bug §6.8 — community-token + wallet-symbol id maps now live in
// lib/market/tokenIdMaps so the live /stats route resolves identically.

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const lower = rawId.toLowerCase();
  // Community-token slugs (NAKA, Pleasure) take precedence over the
  // symbol-to-slug map so /dashboard/market/ethereum/naka-go resolves
  // to the on-chain contract and serves real DexScreener data instead
  // of crashing on a NAKA:USDT CoinGecko lookup that never existed.
  const id = COMMUNITY_TOKEN_CONTRACTS[lower] ?? SYMBOL_TO_SLUG[lower] ?? rawId;

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
        // Audit M8 #2 — was max-age=120 only, no s-maxage, no SWR.
        // Vercel's edge CDN never cached a hot token's payload across
        // users, so every visitor within 2min hit origin -> CoinGecko.
        // Now: 2min browser cache, 10min edge cache, 30min serve-stale-
        // while-revalidating. Industry parity: DexScreener pattern.
        return NextResponse.json(data, {
          headers: { 'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=1800' },
        });
      }
    } catch { /* fall through to DexScreener */ }
  }

  // Fallback path — DexScreener by contract address.
  try {
    const data = await dexscreenerFallback(id);
    if (!data) return NextResponse.json({ error: 'Token not found on any data source' }, { status: 404 });
    // DexScreener pair data refreshes faster than CoinGecko snapshots
    // so 60s browser, 5min edge, 15min stale-while-revalidate.
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
