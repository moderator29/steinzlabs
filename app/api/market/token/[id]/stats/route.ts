import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenPairsLive,
  extractDexSocials,
  type DexPair,
} from '@/lib/services/dexscreener';
import { getPoolStats } from '@/lib/services/geckoterminal';
import { resolveTokenId } from '@/lib/market/tokenIdMaps';
import type { TokenStats, StatTier, TxnTier } from '@/lib/market/tokenStats';

export const dynamic = 'force-dynamic';

/**
 * Live token-stats endpoint powering the terminal's left-side stats panel.
 *
 * Returns the normalized {@link TokenStats} shape. Data sources, in order:
 *   1. DexScreener (getTokenPairsLive, 5s cache) — the deepest pair on the
 *      page's chain. Provides price/native price/liquidity/FDV/mcap/change
 *      tiers/txn counts/volume tiers/socials/logo for any token with a DEX
 *      pair (the long-tail + most majors).
 *   2. GeckoTerminal pool stats (8s cache) — real UNIQUE buyer/seller counts
 *      DexScreener's public API doesn't expose. Enriches the "Traders" split.
 *   3. CoinGecko /coins/{slug} — majors WITHOUT a canonical DEX pair (BTC,
 *      XRP, native L1s). Price/mcap/FDV/volume/1h/24h only; DEX-only metrics
 *      (m5/6h change, txns, traders, native price) stay honestly null.
 *
 * Never fabricates: any metric a source doesn't carry is returned as null so
 * the panel renders an honest empty state.
 */

const CG_BASE = 'https://api.coingecko.com/api/v3';
function cgHeaders(): Record<string, string> {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

const GT_SUPPORTED = new Set(['ethereum', 'polygon', 'bsc', 'solana', 'arbitrum', 'optimism', 'base', 'avalanche']);

function num(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function tiersFromPair(pair: DexPair): { change: StatTier; volume: StatTier; txns: TxnTier } {
  const change: StatTier = {
    m5: num(pair.priceChange?.m5),
    h1: num(pair.priceChange?.h1),
    h6: num(pair.priceChange?.h6),
    h24: num(pair.priceChange?.h24),
  };
  const volume: StatTier = {
    m5: num(pair.volume?.m5),
    h1: num(pair.volume?.h1),
    h6: num(pair.volume?.h6),
    h24: num(pair.volume?.h24),
  };
  const t = pair.txns;
  const txns: TxnTier = {
    m5: t?.m5 ? { buys: t.m5.buys ?? 0, sells: t.m5.sells ?? 0 } : null,
    h1: t?.h1 ? { buys: t.h1.buys ?? 0, sells: t.h1.sells ?? 0 } : null,
    h6: t?.h6 ? { buys: t.h6.buys ?? 0, sells: t.h6.sells ?? 0 } : null,
    h24: t?.h24 ? { buys: t.h24.buys ?? 0, sells: t.h24.sells ?? 0 } : null,
  };
  return { change, volume, txns };
}

function emptyTier(): StatTier {
  return { m5: null, h1: null, h6: null, h24: null };
}

async function fromDexScreener(id: string, chain: string): Promise<TokenStats | null> {
  const pairs = await getTokenPairsLive(id);
  if (pairs.length === 0) return null;

  // Prefer the deepest-liquidity pair ON the page's chain; fall back to the
  // deepest overall so a token that only trades on another chain still resolves.
  const c = chain.toLowerCase();
  const byLiq = (a: DexPair, b: DexPair) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
  const onChain = pairs.filter((p) => p.chainId?.toLowerCase() === c).sort(byLiq);
  const pair = (onChain[0] ?? pairs.slice().sort(byLiq)[0]);
  if (!pair) return null;

  const socials = extractDexSocials(pair);
  const { change, volume, txns } = tiersFromPair(pair);

  // Real unique buyer/seller counts from GeckoTerminal when the chain + pool
  // are supported. Falls through to null (honest empty Traders state) otherwise.
  let buyers24h: number | null = null;
  let sellers24h: number | null = null;
  const pairChain = pair.chainId?.toLowerCase();
  if (pairChain && GT_SUPPORTED.has(pairChain) && pair.pairAddress) {
    try {
      const gt = await getPoolStats(pairChain, pair.pairAddress);
      if (gt) {
        buyers24h = num(gt.buyers24h);
        sellers24h = num(gt.sellers24h);
      }
    } catch { /* GT optional — stay null */ }
  }

  return {
    source: 'dexscreener',
    name: pair.baseToken.name,
    symbol: (pair.baseToken.symbol || '').toUpperCase(),
    logo: pair.info?.imageUrl ?? null,
    chain: pair.chainId ?? chain,
    address: pair.baseToken.address ?? null,
    pairAddress: pair.pairAddress ?? null,
    dexId: pair.dexId ?? null,
    website: socials.website,
    twitter: socials.twitter,
    telegram: socials.telegram,
    priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) || null : null,
    priceNative: pair.priceNative || null,
    nativeSymbol: pair.quoteToken?.symbol ? pair.quoteToken.symbol.toUpperCase() : null,
    liquidityUsd: num(pair.liquidity?.usd),
    fdv: num(pair.fdv),
    marketCap: num(pair.marketCap),
    change,
    volume,
    txns,
    buyers24h,
    sellers24h,
    buyVol24h: null,
    sellVol24h: null,
    updatedAt: Date.now(),
  };
}

interface CgDetail {
  id: string;
  symbol?: string;
  name?: string;
  image?: { small?: string; thumb?: string; large?: string };
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    fully_diluted_valuation?: { usd?: number };
    total_volume?: { usd?: number };
    price_change_percentage_1h_in_currency?: { usd?: number };
    price_change_percentage_24h?: number;
  };
  links?: {
    homepage?: string[];
    twitter_screen_name?: string;
    telegram_channel_identifier?: string;
  };
}

async function fromCoinGecko(id: string, chain: string): Promise<TokenStats | null> {
  const url = new URL(`${CG_BASE}/coins/${id}`);
  url.searchParams.set('localization', 'false');
  url.searchParams.set('tickers', 'false');
  url.searchParams.set('market_data', 'true');
  url.searchParams.set('community_data', 'false');
  url.searchParams.set('developer_data', 'false');
  url.searchParams.set('sparkline', 'false');

  const res = await fetch(url.toString(), { headers: cgHeaders(), next: { revalidate: 30 } } as RequestInit);
  if (!res.ok) return null;
  const d = (await res.json()) as CgDetail;
  const md = d.market_data;
  if (!md) return null;

  const change = emptyTier();
  change.h1 = num(md.price_change_percentage_1h_in_currency?.usd);
  change.h24 = num(md.price_change_percentage_24h);
  const volume = emptyTier();
  volume.h24 = num(md.total_volume?.usd);

  const homepage = d.links?.homepage?.find((h) => !!h) ?? null;
  const twitter = d.links?.twitter_screen_name ? `https://twitter.com/${d.links.twitter_screen_name}` : null;
  const telegram = d.links?.telegram_channel_identifier ? `https://t.me/${d.links.telegram_channel_identifier}` : null;

  return {
    source: 'coingecko',
    name: d.name ?? id,
    symbol: (d.symbol ?? '').toUpperCase(),
    logo: d.image?.small ?? d.image?.thumb ?? null,
    chain,
    address: null,
    pairAddress: null,
    dexId: null,
    website: homepage,
    twitter,
    telegram,
    priceUsd: num(md.current_price?.usd),
    priceNative: null,
    nativeSymbol: null,
    liquidityUsd: null,
    fdv: num(md.fully_diluted_valuation?.usd),
    marketCap: num(md.market_cap?.usd),
    change,
    volume,
    txns: { m5: null, h1: null, h6: null, h24: null },
    buyers24h: null,
    sellers24h: null,
    buyVol24h: null,
    sellVol24h: null,
    updatedAt: Date.now(),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const chain = req.nextUrl.searchParams.get('chain') || 'ethereum';
  const { id, isContract } = resolveTokenId(rawId);

  try {
    // Contract-shaped id → straight to DexScreener (CoinGecko /coins/:id only
    // accepts slugs, so a contract lookup there is a guaranteed 404).
    if (isContract) {
      const dex = await fromDexScreener(id, chain);
      if (dex) return json(dex);
      return NextResponse.json({ error: 'No live pair found for this token' }, { status: 404 });
    }

    // Slug/symbol → CoinGecko first (majors), DexScreener as a fallback for
    // community slugs CoinGecko doesn't index.
    const cg = await fromCoinGecko(id, chain).catch(() => null);
    if (cg && cg.priceUsd != null) return json(cg);

    const dex = await fromDexScreener(id, chain).catch(() => null);
    if (dex) return json(dex);
    if (cg) return json(cg);

    return NextResponse.json({ error: 'Token not found on any data source' }, { status: 404 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load stats' },
      { status: 500 },
    );
  }
}

function json(stats: TokenStats) {
  // Short edge cache so a burst of pollers on one hot token collapses upstream,
  // while the ~4s client cadence still surfaces fresh values each tick.
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, max-age=4, s-maxage=4, stale-while-revalidate=15' },
  });
}
