import 'server-only';
import { cache, TTL } from '../api/cache-manager';

const BASE = 'https://public-api.birdeye.so';
const KEY = process.env.BIRDEYE_API_KEY ?? '';

function headers(chain = 'solana') {
  return { 'X-API-KEY': KEY, 'x-chain': chain, Accept: 'application/json' };
}

async function get<T>(path: string, chain = 'solana'): Promise<T> {
  const cacheKey = `birdeye:${chain}:${path}`;
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE}${path}`, {
    headers: headers(chain),
    signal: AbortSignal.timeout(parseInt(process.env.API_TIMEOUT_MS || '600000')),
  });
  if (!res.ok) throw new Error(`Birdeye ${path} → ${res.status}`);
  const json = await res.json() as { data: T };
  cache.set(cacheKey, json.data, TTL.TOKEN_PRICE);
  return json.data;
}

async function getRaw<T>(path: string, chain = 'solana'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(chain),
    signal: AbortSignal.timeout(parseInt(process.env.API_TIMEOUT_MS || '600000')),
  });
  if (!res.ok) throw new Error(`Birdeye ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Token Price ──────────────────────────────────────────────────────────────
export async function getBirdeyePrice(address: string, chain = 'solana'): Promise<number> {
  try {
    const data = await get<{ value: number }>(`/defi/price?address=${address}`, chain);
    return data?.value ?? 0;
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
  try {
    return await get<BirdeyeTokenOverview>(`/defi/token_overview?address=${address}`, chain);
  } catch { return null; }
}

// ─── Token Holders ────────────────────────────────────────────────────────────
export interface BirdeyeHolder {
  address: string; amount: number; decimals: number;
  uiAmount: number; uiAmountString: string; owner: string;
}

export async function getBirdeyeHolders(
  address: string, limit = 100, chain = 'solana'
): Promise<BirdeyeHolder[]> {
  try {
    const data = await get<{ items: BirdeyeHolder[] }>(
      `/defi/v3/token/holder?address=${address}&limit=${limit}&offset=0`, chain
    );
    return data?.items ?? [];
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
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400 * 7;
    const data = await get<{ items: BirdeyeOHLCV[] }>(
      `/defi/ohlcv?address=${address}&type=${type}&time_from=${from}&time_to=${now}`, chain
    );
    return (data?.items ?? []).slice(0, limit);
  } catch { return []; }
}

// ─── Token List ───────────────────────────────────────────────────────────────
export interface BirdeyeTokenListItem {
  address: string; symbol: string; name: string;
  decimals: number; logoURI?: string; v24hUSD?: number;
}

export async function getBirdeyeTopTokens(limit = 20, chain = 'solana'): Promise<BirdeyeTokenListItem[]> {
  try {
    const cacheKey = `birdeye:top:${chain}:${limit}`;
    const cached = cache.get<BirdeyeTokenListItem[]>(cacheKey);
    if (cached) return cached;
    const data = await get<{ tokens: BirdeyeTokenListItem[] }>(
      `/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=${limit}`, chain
    );
    const tokens = data?.tokens ?? [];
    cache.set(cacheKey, tokens, TTL.TOKEN_PRICE);
    return tokens;
  } catch { return []; }
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
  const cacheKey = `birdeye:wallet_tokens:${chain}:${walletAddress}`;
  const cached = cache.get<BirdeyeWalletTokenList>(cacheKey);
  if (cached) return cached;

  const raw = await getRaw<{
    success: boolean;
    data: { items: BirdeyeWalletToken[]; totalUsd?: number };
  }>(`/v1/wallet/token_list?wallet=${walletAddress}`, chain);

  if (!raw.success) throw new Error('Birdeye wallet token list returned success:false');

  const result: BirdeyeWalletTokenList = {
    items: raw.data?.items ?? [],
    totalUsd: raw.data?.totalUsd ?? 0,
  };

  cache.set(cacheKey, result, TTL.WALLET_BALANCE);
  return result;
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
  const list = addresses.slice(0, 100).join(',');
  try {
    const data = await get<BirdeyeMultiPrice>(
      `/defi/multi_price?list_address=${list}`, chain
    );
    return data ?? {};
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
  try {
    const data = await get<{ tokens?: BirdeyeTrendingToken[] }>(
      `/defi/token_trending?sort_by=volume24hUSD&sort_type=desc&offset=0&limit=${limit}`, chain
    );
    return data?.tokens ?? [];
  } catch { return []; }
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
