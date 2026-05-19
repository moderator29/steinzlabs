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

// Bug §6.8 — community tokens that aren't indexed by CoinGecko (NAKA,
// Pleasure Coin, etc.) need their slug routed to the on-chain contract
// so the DexScreener fallback kicks in instead of returning a CoinGecko
// 404. Slug → EVM contract. Keep this list short — only the tokens we
// explicitly support deep-link routes for. Anything else either resolves
// via CoinGecko (handled below) or via the contract directly.
const COMMUNITY_TOKEN_CONTRACTS: Record<string, string> = {
  // $NAKA — ETH-only, Uniswap-traded community token. Memory: ETH-only,
  // 0x6967b9a8c0b14849CFE8f9E5732B401433fD2898, threshold 1,227,000.
  'naka':    '0x6967b9a8c0b14849CFE8f9E5732B401433fD2898',
  'naka-go': '0x6967b9a8c0b14849CFE8f9E5732B401433fD2898',
  // Pleasure Coin — Polygon-traded. DexScreener auto-detects chain from
  // the contract address so we don't have to plumb chain through.
  'pleasure':      '0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19',
  'pleasure-coin': '0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19',
  // Round-2 deep-dive — wallet rows pass token.symbol when contractAddress
  // is null at click time. Map the on-chain symbol so the same
  // /api/market/token/NSFW lookup that powers price + chart resolves.
  'nsfw':          '0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19',
};

// Common wallet-side symbols the user might URL-ify (eth/btc/sol/etc)
// don't match CoinGecko slugs directly. Map the obvious ones so the
// coin-detail page stops showing $0.00 for native assets when the
// wallet links to /coin/<chain>/eth instead of /coin/<chain>/ethereum.
const SYMBOL_TO_SLUG: Record<string, string> = {
  eth: 'ethereum',
  weth: 'weth',
  btc: 'bitcoin',
  wbtc: 'wrapped-bitcoin',
  sol: 'solana',
  bnb: 'binancecoin',
  wbnb: 'wbnb',
  matic: 'matic-network',
  pol: 'polygon-ecosystem-token',
  avax: 'avalanche-2',
  arb: 'arbitrum',
  op: 'optimism',
  usdc: 'usd-coin',
  usdt: 'tether',
  dai: 'dai',
  link: 'chainlink',
  uni: 'uniswap',
  ltc: 'litecoin',
  trx: 'tron',
  doge: 'dogecoin',
  shib: 'shiba-inu',
};

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
