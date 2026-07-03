import 'server-only';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';
// Free, keyless fallback providers. Birdeye is a PAID API — without
// BIRDEYE_API_KEY (or when a call fails/returns empty) these keep the Solana
// data features alive at zero cost by returning the EXACT same shapes.
import { getTokenPrice, getTokenPrices } from './jupiter';
import { getTokenMeta, getPoolsForIngest } from './geckoterminal';
import { getTokenPairs, getDexPriceForChain, type DexPair } from './dexscreener';
import {
  getSolanaTokenHolders,
  getSolanaWalletTokens,
  getSolanaTokenMetaBatch,
} from './alchemy-solana';

const BASE = 'https://public-api.birdeye.so';
const KEY = process.env.BIRDEYE_API_KEY ?? '';
// When there's no key, skip the paid request entirely (it would 401) and go
// straight to the free fallback — saves a doomed round-trip and avoids noise.
const HAS_KEY = KEY.length > 0;

// Our chain slug → GeckoTerminal network slug (mirrors geckoterminal.ts, kept
// local so we don't reach into that module's private map). Used by the OHLCV
// fallback, which is addressed per-network.
const GT_NET: Record<string, string> = {
  solana: 'solana',
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  bsc: 'bsc',
  polygon: 'polygon_pos',
  avalanche: 'avax',
};

function headers(chain = 'solana') {
  return { 'X-API-KEY': KEY, 'x-chain': chain, Accept: 'application/json' };
}

async function get<T>(path: string, chain = 'solana'): Promise<T> {
  const cacheKey = `birdeye:${chain}:${path}`;
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE}${path}`, {
    headers: headers(chain),
    signal: AbortSignal.timeout(parseInt(process.env.API_TIMEOUT_MS || '15000')),
  });
  if (!res.ok) throw new Error(`Birdeye ${path} → ${res.status}`);
  const json = await res.json() as { data: T };
  cache.set(cacheKey, json.data, TTL.TOKEN_PRICE);
  return json.data;
}

async function getRaw<T>(path: string, chain = 'solana'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(chain),
    signal: AbortSignal.timeout(parseInt(process.env.API_TIMEOUT_MS || '15000')),
  });
  if (!res.ok) throw new Error(`Birdeye ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Free fallback helpers ──────────────────────────────────────────────────
// These exist so core Solana features don't silently starve when the paid
// Birdeye key is missing or a call fails. They only ever return REAL values
// pulled from free providers; fields the free source can't supply are left at
// honest zero/null (never fabricated).

/** Deepest-liquidity DexScreener pair for a token on the given chain. */
async function bestPairForChain(address: string, chain: string): Promise<DexPair | null> {
  try {
    const pairs = await getTokenPairs(address);
    if (pairs.length === 0) return null;
    const c = chain.toLowerCase();
    const onChain = pairs.filter((p) => p.chainId?.toLowerCase() === c);
    const pool = (onChain.length ? onChain : pairs).sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    );
    return pool[0] ?? null;
  } catch {
    return null;
  }
}

/** Birdeye OHLCV `type` (e.g. 15m / 1H / 4H / 1D) → GeckoTerminal timeframe. */
function toGeckoTimeframe(type: string): { tf: 'day' | 'hour' | 'minute'; aggregate: number } {
  const match = /^(\d+)?\s*([a-zA-Z])/.exec(type.trim());
  const n = match?.[1] ? parseInt(match[1], 10) : 1;
  const unit = match?.[2] ?? 'H';
  if (unit === 'm') return { tf: 'minute', aggregate: n };
  if (unit === 'h' || unit === 'H') return { tf: 'hour', aggregate: n };
  // D / W / M all collapse to daily candles (GeckoTerminal's coarsest bucket).
  return { tf: 'day', aggregate: 1 };
}

/** GeckoTerminal pool OHLCV → BirdeyeOHLCV[]. Keyless. */
async function geckoPoolOHLCV(
  chain: string,
  pool: string,
  type: string,
  limit: number,
): Promise<BirdeyeOHLCV[]> {
  const net = GT_NET[chain.toLowerCase()];
  if (!net || !pool) return [];
  const { tf, aggregate } = toGeckoTimeframe(type);
  const key = cacheKey('birdeye_fb', 'ohlcv', { net, pool, tf, aggregate, limit });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    try {
      const url =
        `https://api.geckoterminal.com/api/v2/networks/${net}/pools/${pool}` +
        `/ohlcv/${tf}?aggregate=${aggregate}&limit=${Math.min(limit, 1000)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json;version=20230302' },
        signal: AbortSignal.timeout(parseInt(process.env.API_TIMEOUT_MS || '15000')),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as {
        data?: { attributes?: { ohlcv_list?: number[][] } };
      };
      const rows = body.data?.attributes?.ohlcv_list ?? [];
      // GeckoTerminal rows: [timestamp, open, high, low, close, volume]
      return rows
        .map((r) => ({
          unixTime: r[0] ?? 0,
          open: r[1] ?? 0,
          high: r[2] ?? 0,
          low: r[3] ?? 0,
          close: r[4] ?? 0,
          volume: r[5] ?? 0,
        }))
        .slice(0, limit);
    } catch {
      return [];
    }
  });
}

// ─── Token Price ──────────────────────────────────────────────────────────────
export async function getBirdeyePrice(address: string, chain = 'solana'): Promise<number> {
  if (HAS_KEY) {
    try {
      const data = await get<{ value: number }>(`/defi/price?address=${address}`, chain);
      if (data?.value) return data.value;
    } catch { /* fall through to free price */ }
  }
  // Free fallback: Jupiter for Solana mints, DexScreener chain-scoped price
  // for everything else (and as a Solana backstop when Jupiter has no route).
  try {
    if (chain === 'solana') {
      const jup = await getTokenPrice(address);
      if (jup > 0) return jup;
    }
    return await getDexPriceForChain(address, chain);
  } catch { return 0; }
}

// ─── Token Overview ───────────────────────────────────────────────────────────
export interface BirdeyeTokenOverview {
  address: string; symbol: string; name: string; decimals: number;
  price: number; priceChange24hPercent: number; volume24h: number;
  marketCap: number; liquidity: number; holder: number;
  logoURI?: string; extensions?: Record<string, string>;
}

export async function getBirdeyeTokenOverview(address: string, chain = 'solana'): Promise<BirdeyeTokenOverview | null> {
  if (HAS_KEY) {
    try {
      const paid = await get<BirdeyeTokenOverview>(`/defi/token_overview?address=${address}`, chain);
      if (paid) return paid;
    } catch { /* fall through to free overview */ }
  }
  return overviewFromFree(address, chain);
}

/**
 * Free overview: GeckoTerminal token meta (symbol/name/decimals/logo/price) +
 * the deepest DexScreener pair (price / 24h change / 24h volume / liquidity /
 * market cap). `holder` isn't available from either free source, so it stays 0
 * rather than being invented.
 */
async function overviewFromFree(address: string, chain: string): Promise<BirdeyeTokenOverview | null> {
  const key = cacheKey('birdeye_fb', 'overview', { address, chain });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const [meta, pair] = await Promise.all([
      getTokenMeta(chain, address).catch(() => null),
      bestPairForChain(address, chain),
    ]);
    if (!meta && !pair) return null;

    const pairPrice = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
    return {
      address,
      symbol: meta?.symbol ?? pair?.baseToken?.symbol ?? '',
      name: meta?.name ?? pair?.baseToken?.name ?? '',
      decimals: meta?.decimals ?? 0,
      price: meta?.priceUsd ?? pairPrice,
      priceChange24hPercent: pair?.priceChange?.h24 ?? 0,
      volume24h: pair?.volume?.h24 ?? 0,
      marketCap: pair?.marketCap ?? pair?.fdv ?? 0,
      liquidity: pair?.liquidity?.usd ?? 0,
      holder: 0, // not available from free sources — honest zero
      logoURI: meta?.logo ?? pair?.info?.imageUrl ?? undefined,
    };
  });
}

// ─── Token Holders ────────────────────────────────────────────────────────────
export interface BirdeyeHolder {
  address: string; amount: number; decimals: number;
  uiAmount: number; uiAmountString: string; owner: string;
}

export async function getBirdeyeHolders(
  address: string, limit = 100, chain = 'solana'
): Promise<BirdeyeHolder[]> {
  if (HAS_KEY) {
    try {
      const data = await get<{ items: BirdeyeHolder[] }>(
        `/defi/v3/token/holder?address=${address}&limit=${limit}&offset=0`, chain
      );
      if (data?.items?.length) return data.items;
    } catch { /* fall through to free holders */ }
  }
  // Free fallback (Solana only): Alchemy getTokenLargestAccounts → owner wallets.
  // It exposes the owner + uiAmount but not raw amount/decimals, so those stay 0.
  if (chain !== 'solana') return [];
  try {
    const holders = await getSolanaTokenHolders(address);
    return holders.slice(0, limit).map((h) => ({
      address: h.address,
      amount: 0, // raw base-unit amount unavailable from largest-accounts RPC
      decimals: 0,
      uiAmount: h.uiAmount,
      uiAmountString: String(h.uiAmount),
      owner: h.address,
    }));
  } catch { return []; }
}

// ─── OHLCV Data ───────────────────────────────────────────────────────────────
export interface BirdeyeOHLCV {
  unixTime: number; open: number; high: number; low: number;
  close: number; volume: number;
}

export async function getBirdeyeOHLCV(
  address: string, type = '1H', limit = 100, chain = 'solana'
): Promise<BirdeyeOHLCV[]> {
  if (HAS_KEY) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - 86400 * 7;
      const data = await get<{ items: BirdeyeOHLCV[] }>(
        `/defi/ohlcv?address=${address}&type=${type}&time_from=${from}&time_to=${now}`, chain
      );
      if (data?.items?.length) return data.items.slice(0, limit);
    } catch { /* fall through to free OHLCV */ }
  }
  // Free fallback: GeckoTerminal candles for the token's deepest pool. Requires
  // resolving a pool address first (GeckoTerminal OHLCV is pool-, not token-scoped).
  const pair = await bestPairForChain(address, chain);
  if (!pair?.pairAddress) return [];
  return geckoPoolOHLCV(pair.chainId || chain, pair.pairAddress, type, limit);
}

// ─── Token List ───────────────────────────────────────────────────────────────
export interface BirdeyeTokenListItem {
  address: string; symbol: string; name: string;
  decimals: number; logoURI?: string; v24hUSD?: number;
}

export async function getBirdeyeTopTokens(limit = 20, chain = 'solana'): Promise<BirdeyeTokenListItem[]> {
  const cKey = `birdeye:top:${chain}:${limit}`;
  const cached = cache.get<BirdeyeTokenListItem[]>(cKey);
  if (cached) return cached;
  if (HAS_KEY) {
    try {
      const data = await get<{ tokens: BirdeyeTokenListItem[] }>(
        `/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=${limit}`, chain
      );
      if (data?.tokens?.length) {
        cache.set(cKey, data.tokens, TTL.TOKEN_PRICE);
        return data.tokens;
      }
    } catch { /* fall through to free trending */ }
  }
  // Free fallback: GeckoTerminal trending pools (their base tokens). decimals
  // aren't in the pool payload, so they stay 0.
  const pairs = await trendingPairsFree(chain, limit);
  const tokens: BirdeyeTokenListItem[] = pairs.map((p) => ({
    address: p.baseToken.address,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    decimals: 0,
    logoURI: p.info?.imageUrl,
    v24hUSD: p.volume?.h24 ?? 0,
  }));
  cache.set(cKey, tokens, TTL.TOKEN_PRICE);
  return tokens;
}

/**
 * Shared free trending source: GeckoTerminal trending pools for a chain,
 * deduped by base-token address. Keyless. Returns [] for unsupported chains.
 */
async function trendingPairsFree(chain: string, limit: number): Promise<DexPair[]> {
  if (!GT_NET[chain.toLowerCase()]) return [];
  const key = cacheKey('birdeye_fb', 'trending', { chain, limit });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    try {
      const pools = await getPoolsForIngest(chain, 1, 'trending_pools');
      const seen = new Set<string>();
      const out: DexPair[] = [];
      for (const p of pools) {
        const addr = p.baseToken?.address;
        if (!addr || seen.has(addr)) continue;
        seen.add(addr);
        out.push(p);
        if (out.length >= limit) break;
      }
      return out;
    } catch {
      return [];
    }
  });
}

// ─── Wallet Token List ────────────────────────────────────────────────────────
export interface BirdeyeWalletToken {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
  uiAmount: number;
  priceUsd: number;
  valueUsd: number;
  priceChange24h?: number;
}

export interface BirdeyeWalletTokenList {
  items: BirdeyeWalletToken[];
  totalUsd: number;
}

/**
 * Returns ALL tokens in a wallet with current USD prices and values.
 * Primary fix for the token count bug — no slicing done here.
 */
export async function getWalletTokenList(
  walletAddress: string,
  chain = 'solana'
): Promise<BirdeyeWalletTokenList> {
  const cKey = `birdeye:wallet_tokens:${chain}:${walletAddress}`;
  const cached = cache.get<BirdeyeWalletTokenList>(cKey);
  if (cached) return cached;

  if (HAS_KEY) {
    try {
      const raw = await getRaw<{
        success: boolean;
        data: { items: BirdeyeWalletToken[]; totalUsd?: number };
      }>(`/v1/wallet/token_list?wallet=${walletAddress}`, chain);

      if (raw.success && (raw.data?.items?.length ?? 0) > 0) {
        const result: BirdeyeWalletTokenList = {
          items: raw.data.items,
          totalUsd: raw.data?.totalUsd ?? 0,
        };
        cache.set(cKey, result, TTL.WALLET_BALANCE);
        return result;
      }
    } catch { /* fall through to free wallet tokens */ }
  }

  const result = await walletTokensFree(walletAddress, chain);
  cache.set(cKey, result, TTL.WALLET_BALANCE);
  return result;
}

/**
 * Free wallet token list (Solana only): Alchemy balances + Jupiter batch prices
 * + Alchemy DAS metadata (symbol/name/logo). USD values are computed from real
 * prices; priceChange24h isn't available from these sources, so it's left unset.
 */
async function walletTokensFree(walletAddress: string, chain: string): Promise<BirdeyeWalletTokenList> {
  if (chain !== 'solana') return { items: [], totalUsd: 0 };
  try {
    const balances = await getSolanaWalletTokens(walletAddress);
    if (balances.length === 0) return { items: [], totalUsd: 0 };

    const mints = balances.map((b) => b.mint);
    const [prices, metas] = await Promise.all([
      getTokenPrices(mints).catch(() => ({} as Record<string, number>)),
      getSolanaTokenMetaBatch(mints).catch(() => new Map()),
    ]);

    let totalUsd = 0;
    const items: BirdeyeWalletToken[] = balances.map((b) => {
      const meta = metas.get(b.mint);
      const priceUsd = prices[b.mint] ?? 0;
      const valueUsd = b.uiAmount * priceUsd;
      totalUsd += valueUsd;
      return {
        address: b.mint,
        symbol: meta?.symbol ?? '',
        name: meta?.name ?? '',
        logoURI: meta?.logoUrl ?? undefined,
        decimals: b.decimals,
        uiAmount: b.uiAmount,
        priceUsd,
        valueUsd,
      };
    });

    return { items, totalUsd };
  } catch {
    return { items: [], totalUsd: 0 };
  }
}

// ─── Wallet Transactions ──────────────────────────────────────────────────────
export interface BirdeyeWalletTx {
  txHash: string;
  blockTime: number; // Unix timestamp seconds
  status: string;
  from: string;
  to: string;
  type: string;
  tokenTransfers?: Array<{
    mint: string;
    symbol: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
  }>;
}

export interface BirdeyeWalletTxList {
  items: BirdeyeWalletTx[];
  total: number;
}

/**
 * Returns wallet transaction history with timestamps.
 * Used for TX count, First Seen, Last Active, and trading pattern analysis.
 */
export async function getWalletTransactions(
  walletAddress: string,
  limit = 100,
  chain = 'solana'
): Promise<BirdeyeWalletTxList> {
  const cacheKey = `birdeye:wallet_txs:${chain}:${walletAddress}:${limit}`;
  const cached = cache.get<BirdeyeWalletTxList>(cacheKey);
  if (cached) return cached;

  const raw = await getRaw<{
    success: boolean;
    data: { items: BirdeyeWalletTx[]; total?: number };
  }>(`/v1/wallet/tx_list?wallet=${walletAddress}&limit=${limit}`, chain);

  if (!raw.success) throw new Error('Birdeye wallet tx list returned success:false');

  const result: BirdeyeWalletTxList = {
    items: raw.data?.items ?? [],
    total: raw.data?.total ?? (raw.data?.items?.length ?? 0),
  };

  cache.set(cacheKey, result, TTL.WALLET_BALANCE);
  return result;
}

// ─── Multi-price ──────────────────────────────────────────────────────────────
export interface BirdeyeMultiPrice {
  [address: string]: { value: number; updateUnixTime: number; priceChange24h?: number };
}

/**
 * Batch fetch prices for multiple token addresses (up to 100).
 * More efficient than calling getTokenOverview individually for each token.
 */
export async function getMultiTokenPrices(
  addresses: string[],
  chain = 'solana'
): Promise<BirdeyeMultiPrice> {
  if (addresses.length === 0) return {};
  const slice = addresses.slice(0, 100);
  if (HAS_KEY) {
    try {
      const data = await get<BirdeyeMultiPrice>(
        `/defi/multi_price?list_address=${slice.join(',')}`, chain
      );
      if (data && Object.keys(data).length) return data;
    } catch { /* fall through to free batch prices */ }
  }
  // Free fallback (Solana): Jupiter batch price. updateUnixTime is stamped now;
  // priceChange24h isn't provided by Jupiter, so it's omitted (not fabricated).
  if (chain !== 'solana') return {};
  try {
    const prices = await getTokenPrices(slice);
    const now = Math.floor(Date.now() / 1000);
    const out: BirdeyeMultiPrice = {};
    for (const [addr, value] of Object.entries(prices)) {
      if (value > 0) out[addr] = { value, updateUnixTime: now };
    }
    return out;
  } catch { return {}; }
}

// ─── Trending Tokens ──────────────────────────────────────────────────────────
export interface BirdeyeTrendingToken {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24hPercent: number;
  volume24hUSD: number;
  liquidity: number;
  marketCap?: number;
  holder?: number;
  logoURI?: string;
}

export async function getTrendingByVolume(
  limit = 20,
  chain = 'solana'
): Promise<BirdeyeTrendingToken[]> {
  if (HAS_KEY) {
    try {
      const data = await get<{ tokens?: BirdeyeTrendingToken[] }>(
        `/defi/token_trending?sort_by=volume24hUSD&sort_type=desc&offset=0&limit=${limit}`, chain
      );
      if (data?.tokens?.length) return data.tokens;
    } catch { /* fall through to free trending */ }
  }
  // Free fallback: GeckoTerminal trending pools mapped to the trending shape.
  // marketCap comes through when the pool exposes it; holder isn't available
  // from pool data, so it's omitted rather than invented.
  const pairs = await trendingPairsFree(chain, limit);
  return pairs.map((p) => ({
    address: p.baseToken.address,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    price: p.priceUsd ? parseFloat(p.priceUsd) : 0,
    priceChange24hPercent: p.priceChange?.h24 ?? 0,
    volume24hUSD: p.volume?.h24 ?? 0,
    liquidity: p.liquidity?.usd ?? 0,
    marketCap: p.marketCap ?? p.fdv,
    logoURI: p.info?.imageUrl,
  }));
}

export async function getTrendingByHolderGrowth(
  limit = 20,
  chain = 'solana'
): Promise<BirdeyeTrendingToken[]> {
  try {
    const data = await get<{ tokens?: BirdeyeTrendingToken[] }>(
      `/defi/token_trending?sort_by=holder&sort_type=desc&offset=0&limit=${limit}`, chain
    );
    return data?.tokens ?? [];
  } catch { return []; }
}

// ─── Token Security (Solana) ──────────────────────────────────────────────────
export interface BirdeyeTokenSecurity {
  creationTx?: string;
  creationTime?: number;
  creatorAddress?: string;
  ownerAddress?: string;
  top10HolderPercent?: number;
  isMintable?: boolean;
  freezeable?: boolean;
  lpBurned?: boolean;
}

export async function getBirdeyeTokenSecurity(
  address: string
): Promise<BirdeyeTokenSecurity | null> {
  try {
    return await get<BirdeyeTokenSecurity>(`/defi/token_security?address=${address}`, 'solana');
  } catch { return null; }
}

// ─── New Listings ─────────────────────────────────────────────────────────────
export interface BirdeyeNewListing {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  liquidity: number;
  price: number;
  mc?: number;
  v24hUSD?: number;
  listingTime: number; // Unix timestamp
}

export async function getNewListings(
  chain = 'solana',
  limit = 50
): Promise<BirdeyeNewListing[]> {
  const cacheKey = `birdeye:new_listings:${chain}:${limit}`;
  const cached = cache.get<BirdeyeNewListing[]>(cacheKey);
  if (cached) return cached;
  try {
    const data = await getRaw<{
      success: boolean;
      data: { items: BirdeyeNewListing[] };
    }>(`/defi/token_new_listing?limit=${limit}&min_liquidity=1000`, chain);
    const items = data?.data?.items ?? [];
    cache.set(cacheKey, items, 10_000); // 10s TTL — sniper needs fresh data
    return items;
  } catch { return []; }
}

// ─── Top Traders ──────────────────────────────────────────────────────────────
export interface BirdeyeTopTrader {
  address: string;
  pnl: number;
  pnlPercent: number;
  volume: number;
  trades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  lastTradeTime: number;
}

export async function getTopTraders(
  timeframe: '24h' | '7d' | '30d' = '7d',
  chain = 'solana',
  minTrades = 5,
  minVolume = 20000
): Promise<BirdeyeTopTrader[]> {
  const cacheKey = `birdeye:top_traders:${chain}:${timeframe}:${minTrades}:${minVolume}`;
  const cached = cache.get<BirdeyeTopTrader[]>(cacheKey);
  if (cached) return cached;
  try {
    const raw = await getRaw<{
      success: boolean;
      data: { items: BirdeyeTopTrader[] };
    }>(`/trader/gainers-losers?type=gainers&sort_by=PnL&time_frame=${timeframe}&limit=100`, chain);
    const all = raw?.data?.items ?? [];
    const filtered = all.filter(
      t => t.trades >= minTrades && t.volume >= minVolume
    );
    cache.set(cacheKey, filtered, 600_000); // 10 min TTL
    return filtered;
  } catch { return []; }
}

// ─── Token Top Traders ────────────────────────────────────────────────────────
export interface BirdeyeTokenTraderStat {
  address: string;
  side: 'buy' | 'sell';
  volume: number;
  trades: number;
  avgTradeSize: number;
  tokenAddress: string;
}

export async function getTokenTopTraders(
  tokenAddress: string,
  chain = 'solana'
): Promise<BirdeyeTokenTraderStat[]> {
  const cacheKey = `birdeye:token_traders:${chain}:${tokenAddress}`;
  const cached = cache.get<BirdeyeTokenTraderStat[]>(cacheKey);
  if (cached) return cached;
  try {
    const raw = await getRaw<{
      success: boolean;
      data: { items: BirdeyeTokenTraderStat[] };
    }>(`/defi/trader/token-stat?address=${tokenAddress}&limit=20`, chain);
    const items = raw?.data?.items ?? [];
    cache.set(cacheKey, items, 120_000); // 2 min TTL
    return items;
  } catch { return []; }
}

// ─── Active Trader Qualification ──────────────────────────────────────────────
export interface TraderStats {
  txCount: number;
  uniqueTradingDays: number;
  dexSwapCount: number;
  minTradeUsd: number;
  avgTradeUsd: number;
  lastTradeTime: number;
}

export interface TraderQualification {
  qualified: boolean;
  reason?: string;
  stats: TraderStats;
}

/**
 * Checks if a wallet qualifies as an active daily trader (whale candidate).
 * Criteria: min $20K per trade, 4+ unique trading days in last 7 days,
 * DEX swaps only (not transfers), NOT a bot (non-uniform hourly pattern).
 */
export async function qualifyAsActiveTrader(
  address: string,
  chain = 'solana'
): Promise<TraderQualification> {
  const empty: TraderStats = {
    txCount: 0, uniqueTradingDays: 0, dexSwapCount: 0,
    minTradeUsd: 0, avgTradeUsd: 0, lastTradeTime: 0,
  };
  try {
    const raw = await getRaw<{
      success: boolean;
      data: { items: BirdeyeWalletTx[] };
    }>(`/v1/wallet/tx_list?wallet=${address}&limit=100`, chain);
    const txs = raw?.data?.items ?? [];
    if (txs.length === 0) {
      return { qualified: false, reason: 'No transactions found', stats: empty };
    }
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const recent = txs.filter(tx => tx.blockTime >= sevenDaysAgo);
    if (recent.length === 0) {
      return { qualified: false, reason: 'No trades in last 7 days', stats: empty };
    }
    const daySet = new Set(recent.map(tx =>
      new Date(tx.blockTime * 1000).toISOString().slice(0, 10)
    ));
    const dexSwaps = recent.filter(tx =>
      tx.type?.toLowerCase().includes('swap') || tx.type?.toLowerCase().includes('trade')
    );
    const hourCounts = new Array<number>(24).fill(0);
    recent.forEach(tx => { hourCounts[new Date(tx.blockTime * 1000).getUTCHours()]++; });
    const nonZeroHours = hourCounts.filter(c => c > 0).length;
    const isBot = nonZeroHours >= 20; // trades spread across 20+ hours uniformly = bot
    const stats: TraderStats = {
      txCount: recent.length,
      uniqueTradingDays: daySet.size,
      dexSwapCount: dexSwaps.length,
      minTradeUsd: 0,
      avgTradeUsd: 0,
      lastTradeTime: recent[0]?.blockTime ?? 0,
    };
    if (isBot) return { qualified: false, reason: 'Bot pattern detected (uniform 24h distribution)', stats };
    if (daySet.size < 4) return { qualified: false, reason: `Only ${daySet.size} active trading days (need 4+)`, stats };
    if (dexSwaps.length < 5) return { qualified: false, reason: 'Fewer than 5 DEX swaps detected', stats };
    return { qualified: true, stats };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Qualification check failed';
    return { qualified: false, reason, stats: empty };
  }
}
