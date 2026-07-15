import 'server-only';

/**
 * Coins coin service - assembles a graduated-on-DEX coin from the platform's
 * existing keyless rails and decorates it with our admin flags.
 *
 * Data sources (all already in the codebase, all keyless-capable):
 *  - DexScreener  → price, market cap / FDV, liquidity, volume, %change, txns,
 *                   logo + socials, pair discovery. `getTokenPairsLive` gives a
 *                   ~5s-cached price for the per-second poll.
 *  - GeckoTerminal→ OHLC candles, real buyer/seller split, pool trades.
 *  - Birdeye / GT → trending + new-pair discovery lists.
 *
 * Nothing here signs or holds keys - execution stays client-side.
 */

import {
  getTokenPairs,
  getTokenPairsLive,
  extractDexSocials,
  getNewPairs,
  type DexPair,
} from '@/lib/services/dexscreener';
import { getGtTopPool, getGtCandles, getPoolStats, getPoolsForIngest, getTokenMeta } from '@/lib/services/geckoterminal';
import { getPoolTrades } from '@/lib/services/geckoTrades';
import { getTrendingByVolume } from '@/lib/services/birdeye';
import { normalizeAddress } from '@/lib/utils/addressNormalize';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  COIN_CHAINS,
  isCoinChain,
  type CoinChain,
  type Coin,
  type CoinCandle,
  type CoinTimeframe,
  type CoinStats,
} from './types';

/** A coin is treated as "graduated on DEX" once it has a real pool with at
 *  least this much USD liquidity - pre-graduation bonding-curve tokens don't
 *  clear this bar, so discovery stays honest. */
const GRAD_MIN_LIQUIDITY_USD = 1_000;

export function tokenKeyFor(chain: string, address: string): string {
  return normalizeAddress(address.trim(), chain);
}

/** DexScreener uses the same slug we do for these three chains. */
function dexChainId(chain: string): string {
  return chain.toLowerCase();
}

/** Pick the deepest-liquidity pair for a token on a specific chain. */
function bestPairForChain(pairs: DexPair[], chain: string): DexPair | null {
  const want = dexChainId(chain);
  const onChain = pairs.filter((p) => (p.chainId || '').toLowerCase() === want);
  if (onChain.length === 0) return null;
  return onChain
    .slice()
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function coinFromPair(chain: string, address: string, pair: DexPair): Coin {
  const liquidityUsd = pair.liquidity?.usd ?? null;
  const socials = extractDexSocials(pair);
  return {
    chain,
    tokenAddress: address,
    tokenKey: tokenKeyFor(chain, address),
    symbol: pair.baseToken?.symbol || '',
    name: pair.baseToken?.name || pair.baseToken?.symbol || '',
    logoUrl: pair.info?.imageUrl ?? null,
    decimals: null,
    priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
    marketCapUsd: pair.marketCap ?? pair.fdv ?? null,
    fdvUsd: pair.fdv ?? null,
    liquidityUsd,
    volume24hUsd: pair.volume?.h24 ?? null,
    change5m: pair.priceChange?.m5 ?? null,
    change1h: pair.priceChange?.h1 ?? null,
    change24h: pair.priceChange?.h24 ?? null,
    txns24h: pair.txns?.h24 ? { buys: pair.txns.h24.buys, sells: pair.txns.h24.sells } : null,
    pairAddress: pair.pairAddress ?? null,
    dex: pair.dexId ?? null,
    socials,
    verified: false,
    featured: false,
    isGraduated: liquidityUsd != null && liquidityUsd >= GRAD_MIN_LIQUIDITY_USD,
    holdersCount: null,
    pairCreatedAt: pair.pairCreatedAt ?? null,
  };
}

interface RegistryFlags {
  verified: boolean;
  featured: boolean;
  hidden: boolean;
  holders_count: number | null;
}

async function readRegistryFlags(chain: string, tokenKey: string): Promise<RegistryFlags | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('coin_registry')
      .select('verified, featured, hidden, holders_count')
      .eq('chain', chain)
      .eq('token_key', tokenKey)
      .maybeSingle();
    return (data as RegistryFlags) ?? null;
  } catch {
    return null;
  }
}

/** Cache the freshest snapshot into coin_registry (fire-and-forget). Preserves
 *  admin flags on conflict. */
async function upsertRegistry(coin: Coin): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from('coin_registry').upsert(
      {
        chain: coin.chain,
        token_key: coin.tokenKey,
        token_address: coin.tokenAddress,
        symbol: coin.symbol || null,
        name: coin.name || null,
        logo_url: coin.logoUrl,
        decimals: coin.decimals,
        is_graduated: coin.isGraduated,
        price_usd: coin.priceUsd,
        market_cap_usd: coin.marketCapUsd,
        liquidity_usd: coin.liquidityUsd,
        volume_24h_usd: coin.volume24hUsd,
        change_1h: coin.change1h,
        change_24h: coin.change24h,
        dex: coin.dex,
        pair_address: coin.pairAddress,
        socials: coin.socials,
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: 'chain,token_key' },
    );
  } catch {
    /* non-fatal: registry is a cache */
  }
}

/**
 * Resolve a full coin for the detail page. Returns null if there is no real
 * DEX pair on the requested chain (or the coin is admin-hidden).
 */
export async function resolveCoin(chain: string, address: string): Promise<Coin | null> {
  if (!isCoinChain(chain) || !address) return null;
  const tokenKey = tokenKeyFor(chain, address);

  const [pairs, flags] = await Promise.all([
    getTokenPairs(address).catch(() => [] as DexPair[]),
    readRegistryFlags(chain, tokenKey),
  ]);
  if (flags?.hidden) return null;

  const pair = bestPairForChain(pairs, chain);
  if (!pair) return null;

  const coin = coinFromPair(chain, address, pair);
  if (flags) {
    coin.verified = flags.verified;
    coin.featured = flags.featured;
    coin.holdersCount = flags.holders_count;
  }
  // Real decimals (needed to size a sell correctly) and a logo fallback come
  // from the token /info endpoint when the pair payload lacks them.
  const meta = await getTokenMeta(chain, address).catch(() => null);
  if (meta) {
    if (meta.decimals != null) coin.decimals = meta.decimals;
    if (!coin.logoUrl && meta.logo) coin.logoUrl = meta.logo;
  }
  void upsertRegistry(coin);
  return coin;
}

/** Fast, ~5s-cached price snapshot for the per-second poll on the coin page. */
export async function getLivePrice(
  chain: string,
  address: string,
): Promise<{ priceUsd: number | null; marketCapUsd: number | null; change24h: number | null } | null> {
  if (!isCoinChain(chain) || !address) return null;
  const pairs = await getTokenPairsLive(address).catch(() => [] as DexPair[]);
  const pair = bestPairForChain(pairs, chain);
  if (!pair) return null;
  return {
    priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
    marketCapUsd: pair.marketCap ?? pair.fdv ?? null,
    change24h: pair.priceChange?.h24 ?? null,
  };
}

const TF_MAP: Record<CoinTimeframe, { tf: 'minute' | 'hour' | 'day'; aggregate: number; limit: number }> = {
  '1H': { tf: 'minute', aggregate: 1, limit: 60 },
  '4H': { tf: 'minute', aggregate: 5, limit: 48 },
  '1D': { tf: 'minute', aggregate: 15, limit: 96 },
  '7D': { tf: 'hour', aggregate: 4, limit: 42 },
  '3M': { tf: 'hour', aggregate: 12, limit: 180 },
  ALL: { tf: 'day', aggregate: 1, limit: 365 },
};

/** OHLC candles for the chart. Resolves the deepest pool for the token first. */
export async function getCandles(
  chain: string,
  address: string,
  timeframe: CoinTimeframe,
  pairAddress?: string | null,
): Promise<CoinCandle[]> {
  if (!isCoinChain(chain) || !address) return [];
  const pool = pairAddress || (await getGtTopPool(chain, address));
  if (!pool) return [];
  const { tf, aggregate, limit } = TF_MAP[timeframe] ?? TF_MAP['1H'];
  const candles = await getGtCandles(chain, pool, tf, limit, aggregate);
  return candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}

/** Real buyer/seller split for the About tab. */
export async function getStats(
  chain: string,
  address: string,
  pairAddress?: string | null,
): Promise<CoinStats | null> {
  if (!isCoinChain(chain) || !address) return null;
  const pool = pairAddress || (await getGtTopPool(chain, address));
  if (!pool) return null;
  const s = await getPoolStats(chain, pool);
  if (!s) return null;
  return {
    buys: s.buys24h,
    sells: s.sells24h,
    buyers: s.buyers24h,
    sellers: s.sellers24h,
    buyVolUsd: null, // upstream carries only a combined volume, not a side split
    sellVolUsd: null,
  };
}

/** Recent on-chain swaps for the Feed tab (DEX side). */
export async function getDexTrades(
  chain: string,
  address: string,
  pairAddress?: string | null,
  minVolumeUsd = 0,
): Promise<Array<{ timestamp: number; side: 'buy' | 'sell'; usdAmount: number; tokenAmount: number; priceUsd: number; wallet: string }>> {
  if (!isCoinChain(chain) || !address) return [];
  const pool = pairAddress || (await getGtTopPool(chain, address));
  if (!pool) return [];
  const trades = await getPoolTrades(chain, pool, minVolumeUsd);
  return trades.map((t) => ({
    timestamp: t.timestamp,
    side: t.type,
    usdAmount: t.valueUSD,
    tokenAmount: t.amount,
    priceUsd: t.price,
    wallet: t.wallet,
  }));
}

// ─── Discovery ──────────────────────────────────────────────────────────────

function mapPoolPairs(chain: string, pairs: DexPair[]): Coin[] {
  const seen = new Set<string>();
  const out: Coin[] = [];
  for (const p of pairs) {
    const addr = p.baseToken?.address;
    if (!addr) continue;
    const key = tokenKeyFor(chain, addr);
    if (seen.has(key)) continue;
    seen.add(key);
    const coin = coinFromPair(chain, addr, p);
    if (!coin.isGraduated) continue;
    out.push(coin);
  }
  return out;
}

export type DiscoveryTab = 'trending' | 'graduated' | 'most_held';

/**
 * Discovery list for the Coins area. Keyless: trending + new pools from
 * GeckoTerminal (all three chains) plus Birdeye trending for Solana. Only
 * graduated-on-DEX coins survive the filter.
 */
export async function getDiscovery(tab: DiscoveryTab, chain?: string): Promise<Coin[]> {
  const chains: CoinChain[] = chain && isCoinChain(chain) ? [chain] : [...COIN_CHAINS];

  // "Most held" = the coins our own users hold/trade most, from the registry
  // (holders_count) - falls through to trending when the registry is still thin.
  if (tab === 'most_held') {
    const registryCoins = await getMostHeldFromRegistry(chains);
    if (registryCoins.length >= 8) return registryCoins;
  }

  const perChain = await Promise.all(
    chains.map(async (c) => {
      try {
        if (tab === 'graduated') {
          const pairs = await getNewPairs(GRAD_MIN_LIQUIDITY_USD, c).catch(() => [] as DexPair[]);
          return mapPoolPairs(c, pairs);
        }
        // trending: GeckoTerminal trending pools are the shared keyless source.
        const pairs = await getPoolsForIngest(c, 1, 'trending_pools').catch(() => [] as DexPair[]);
        let coins = mapPoolPairs(c, pairs);
        if (c === 'solana' && coins.length < 8) {
          // Augment Solana with Birdeye trending when GT is thin.
          const bd = await getTrendingByVolume(20, 'solana').catch(() => []);
          const extra: DexPair[] = bd
            .filter((t) => t.address)
            .map((t) => ({
              chainId: 'solana',
              dexId: '',
              url: '',
              pairAddress: '',
              baseToken: { address: t.address, name: t.name || t.symbol || '', symbol: t.symbol || '' },
              quoteToken: { address: '', name: '', symbol: '' },
              priceNative: '0',
              priceUsd: String(t.price ?? 0),
              txns: { m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } },
              volume: { h24: t.volume24hUSD ?? 0, h6: 0, h1: 0, m5: 0 },
              priceChange: { m5: 0, h1: 0, h6: 0, h24: t.priceChange24hPercent ?? 0 },
              liquidity: { usd: t.liquidity ?? GRAD_MIN_LIQUIDITY_USD, base: 0, quote: 0 },
              marketCap: t.marketCap,
              fdv: t.marketCap,
              info: t.logoURI ? { imageUrl: t.logoURI } : undefined,
            } as DexPair));
          coins = [...coins, ...mapPoolPairs(c, extra)];
        }
        return coins;
      } catch {
        return [] as Coin[];
      }
    }),
  );

  const flat = perChain.flat();
  // Dedupe across chains and rank.
  const seen = new Set<string>();
  const deduped: Coin[] = [];
  for (const c of flat) {
    const k = `${c.chain}:${c.tokenKey}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(c);
  }
  deduped.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));

  // Decorate with admin flags + hide admin-hidden coins in one registry read.
  return decorateWithRegistry(deduped);
}

/** Coins the platform already tracks, ranked by known holder count. Used for
 *  the "Most held" chip and as a warm cache so discovery is never empty. */
async function getMostHeldFromRegistry(chains: CoinChain[]): Promise<Coin[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('coin_registry')
      .select('*')
      .in('chain', chains)
      .eq('hidden', false)
      .eq('is_graduated', true)
      .order('holders_count', { ascending: false, nullsFirst: false })
      .order('volume_24h_usd', { ascending: false, nullsFirst: false })
      .limit(50);
    return ((data as RegistryRow[]) ?? []).map(registryRowToCoin);
  } catch {
    return [];
  }
}

interface RegistryRow {
  chain: string; token_key: string; token_address: string; symbol: string | null; name: string | null;
  logo_url: string | null; decimals: number | null; verified: boolean; featured: boolean; is_graduated: boolean;
  price_usd: number | null; market_cap_usd: number | null; liquidity_usd: number | null; volume_24h_usd: number | null;
  change_1h: number | null; change_24h: number | null; holders_count: number | null; dex: string | null;
  pair_address: string | null; socials: Record<string, unknown> | null;
}

function registryRowToCoin(r: RegistryRow): Coin {
  const s = (r.socials ?? {}) as { website?: string | null; twitter?: string | null; telegram?: string | null };
  return {
    chain: r.chain,
    tokenAddress: r.token_address,
    tokenKey: r.token_key,
    symbol: r.symbol ?? '',
    name: r.name ?? r.symbol ?? '',
    logoUrl: r.logo_url,
    decimals: r.decimals,
    priceUsd: r.price_usd,
    marketCapUsd: r.market_cap_usd,
    fdvUsd: r.market_cap_usd,
    liquidityUsd: r.liquidity_usd,
    volume24hUsd: r.volume_24h_usd,
    change5m: null,
    change1h: r.change_1h,
    change24h: r.change_24h,
    txns24h: null,
    pairAddress: r.pair_address,
    dex: r.dex,
    socials: { website: s.website ?? null, twitter: s.twitter ?? null, telegram: s.telegram ?? null },
    verified: r.verified,
    featured: r.featured,
    isGraduated: r.is_graduated,
    holdersCount: r.holders_count,
    pairCreatedAt: null,
  };
}

/** One batched registry read to apply verified/featured and drop hidden coins. */
async function decorateWithRegistry(coins: Coin[]): Promise<Coin[]> {
  if (coins.length === 0) return coins;
  try {
    const sb = getSupabaseAdmin();
    const keys = coins.map((c) => c.tokenKey);
    const { data } = await sb
      .from('coin_registry')
      .select('chain, token_key, verified, featured, hidden, holders_count')
      .in('token_key', keys);
    const flagMap = new Map<string, RegistryFlags & { chain: string; token_key: string }>();
    for (const r of (data as Array<RegistryFlags & { chain: string; token_key: string }>) ?? []) {
      flagMap.set(`${r.chain}:${r.token_key}`, r);
    }
    return coins
      .map((c) => {
        const f = flagMap.get(`${c.chain}:${c.tokenKey}`);
        if (f) {
          if (f.hidden) return null;
          c.verified = f.verified;
          c.featured = f.featured;
          if (f.holders_count != null) c.holdersCount = f.holders_count;
        }
        return c;
      })
      .filter((c): c is Coin => c !== null);
  } catch {
    return coins;
  }
}
