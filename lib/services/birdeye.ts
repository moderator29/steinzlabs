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
