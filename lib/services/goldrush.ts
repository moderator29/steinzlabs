import 'server-only';
import { cache } from '../api/cache-manager';

/**
 * GoldRush (Covalent) — OPTIONAL, fallback-safe multichain data provider.
 *
 * GoldRush is a PAID API. Exactly like the platform's other optional providers
 * (Birdeye, Dune, Trust Wallet gateway), this module is a NO-OP when no key is
 * configured: every function returns null/empty instead of throwing, so callers
 * transparently fall back to the existing free sources (Alchemy RPC, GeckoTerminal,
 * DexScreener, CoinGecko). It never fabricates balances/prices — a field the API
 * can't supply is left at honest null/zero.
 *
 * Auth:  Authorization: Bearer <key>   (Covalent also accepts basic auth with the
 *        key as the username; we use Bearer.)
 * Base:  https://api.covalenthq.com/v1/
 * Key:   COVALENT_API_KEY  (canonical)   ·   GOLDRUSH_API_KEY  (accepted alias)
 * Free tier: ~25k–100k credits, ~4 rps. 8s timeout + small in-memory cache keep
 *            us well under that even under load.
 *
 * Chain-name slugs were VERIFIED against live GoldRush docs (goldrush.dev/chains,
 * quicknode GoldRush API mirror) — see GOLDRUSH_CHAIN below. Any platform chain we
 * could NOT verify to a real GoldRush slug is deliberately left unmapped so its
 * lookups no-op and fall back, rather than guessing a slug and 404-ing.
 */

const BASE = 'https://api.covalenthq.com/v1';

/** Canonical env name is COVALENT_API_KEY; GOLDRUSH_API_KEY is an accepted alias. */
function apiKey(): string {
  return process.env.COVALENT_API_KEY || process.env.GOLDRUSH_API_KEY || '';
}

/** True when a GoldRush/Covalent key is configured. Callers use this to decide
 *  whether to prefer GoldRush or skip straight to the existing free source. */
export function goldrushEnabled(): boolean {
  return apiKey().length > 0;
}

// ─── Chain-id mapping (platform id → VERIFIED GoldRush chainName slug) ────────
// Verified against GoldRush docs. Solana uses the same address-based endpoints
// under its own slug. Robinhood Chain is intentionally NOT hardcoded here: at
// time of writing its GoldRush slug is not published/verifiable, so baking a
// guess would 404. Operators who know the real slug can set GOLDRUSH_ROBINHOOD_CHAIN
// and it will be picked up (see goldrushChainName) — until then Robinhood lookups
// no-op and callers fall back to raw RPC.
export const GOLDRUSH_CHAIN: Record<string, string> = {
  ethereum:  'eth-mainnet',
  base:      'base-mainnet',
  bsc:       'bsc-mainnet',
  arbitrum:  'arbitrum-mainnet',
  optimism:  'optimism-mainnet',
  polygon:   'matic-mainnet',
  avalanche: 'avalanche-mainnet',
  solana:    'solana-mainnet',
};

/** Resolve a platform chain id to a GoldRush chainName slug, or null if we have
 *  no VERIFIED slug for it (caller should then fall back). Robinhood is honored
 *  only via the GOLDRUSH_ROBINHOOD_CHAIN env override (unverified default slug). */
export function goldrushChainName(chain: string): string | null {
  const c = (chain || '').toLowerCase().trim();
  if (c === 'robinhood' || c === 'hood' || c === 'robinhood-chain' || c === '4663') {
    const override = process.env.GOLDRUSH_ROBINHOOD_CHAIN?.trim();
    return override && override.length > 0 ? override : null;
  }
  return GOLDRUSH_CHAIN[c] ?? null;
}

/** Is this chain supported by GoldRush in the current configuration? */
export function goldrushSupportsChain(chain: string): boolean {
  return goldrushChainName(chain) !== null;
}

// ─── Low-level fetch ─────────────────────────────────────────────────────────

const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000; // matches TTL.TOKEN_PRICE granularity

/**
 * GET a GoldRush endpoint. Returns the parsed `data` payload, or null on ANY
 * failure (missing key, non-2xx, GoldRush `error:true`, timeout, parse error).
 * Never throws — the whole point is graceful degradation for callers.
 */
async function grGet<T>(path: string): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;

  const cacheId = `goldrush:${path}`;
  const cached = cache.get<T>(cacheId);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T; error?: boolean; error_message?: string };
    if (json.error || json.data == null) return null;
    cache.set(cacheId, json.data, CACHE_TTL_MS);
    return json.data;
  } catch {
    return null;
  }
}

// ─── Public typed surface ────────────────────────────────────────────────────

export interface GoldrushBalance {
  contractAddress: string | null;
  symbol: string;
  name: string;
  decimals: number;
  /** raw on-chain balance (integer string, base units) */
  balance: string;
  /** human-readable balance (balance / 10^decimals) */
  amount: number;
  /** spot USD value of the position, or null when GoldRush can't price it */
  valueUSD: number | null;
  /** spot USD price per token, or null */
  priceUSD: number | null;
  isNative: boolean;
  logoUrl: string | null;
}

export interface GoldrushTx {
  hash: string;
  blockHeight: number | null;
  blockSignedAt: string | null;
  from: string | null;
  to: string | null;
  value: string;
  valueQuoteUSD: number | null;
  feeQuoteUSD: number | null;
  successful: boolean;
}

export interface OhlcvCandle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

// Raw GoldRush response shapes (only the fields we consume).
interface RawBalancesResponse {
  items?: Array<{
    contract_address?: string | null;
    contract_ticker_symbol?: string | null;
    contract_name?: string | null;
    contract_decimals?: number | null;
    balance?: string | null;
    quote?: number | null;
    quote_rate?: number | null;
    native_token?: boolean;
    logo_url?: string | null;
  }>;
}
interface RawTxResponse {
  items?: Array<{
    tx_hash?: string;
    block_height?: number | null;
    block_signed_at?: string | null;
    from_address?: string | null;
    to_address?: string | null;
    value?: string | null;
    value_quote?: number | null;
    fees_paid?: string | null;
    gas_quote?: number | null;
    successful?: boolean | null;
  }>;
}
interface RawPricingResponse {
  // /pricing/historical_by_addresses_v2 returns an ARRAY of contract items
  prices?: Array<{ date?: string; price?: number | null }>;
}

/**
 * Wallet token balances (native + ERC-20/SPL) for an address on a chain.
 * GoldRush endpoint: /{chainName}/address/{addr}/balances_v2/
 * Returns [] when unavailable (no key / unmapped chain / failure).
 */
export async function getWalletBalances(chain: string, address: string): Promise<GoldrushBalance[]> {
  const chainName = goldrushChainName(chain);
  if (!chainName || !address) return [];
  const data = await grGet<RawBalancesResponse>(
    `/${chainName}/address/${address}/balances_v2/?quote-currency=USD&no-spam=true`,
  );
  if (!data?.items) return [];
  return data.items.map((it) => {
    const decimals = it.contract_decimals ?? 0;
    const raw = it.balance ?? '0';
    let amount = 0;
    try {
      amount = decimals > 0 ? Number(BigInt(raw)) / 10 ** decimals : Number(raw);
    } catch {
      amount = Number(raw) / 10 ** decimals || 0;
    }
    return {
      contractAddress: it.contract_address ?? null,
      symbol: it.contract_ticker_symbol ?? '',
      name: it.contract_name ?? '',
      decimals,
      balance: raw,
      amount,
      valueUSD: typeof it.quote === 'number' ? it.quote : null,
      priceUSD: typeof it.quote_rate === 'number' ? it.quote_rate : null,
      isNative: it.native_token === true,
      logoUrl: it.logo_url ?? null,
    };
  });
}

/**
 * Recent transactions for an address.
 * GoldRush endpoint: /{chainName}/address/{addr}/transactions_v3/
 * Returns [] when unavailable.
 */
export async function getWalletTransactions(
  chain: string,
  address: string,
  opts: { pageSize?: number } = {},
): Promise<GoldrushTx[]> {
  const chainName = goldrushChainName(chain);
  if (!chainName || !address) return [];
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100);
  // transactions_v3 is paginated (page 0 = newest); page-size caps the payload.
  const data = await grGet<RawTxResponse>(
    `/${chainName}/address/${address}/transactions_v3/page/0/?quote-currency=USD&page-size=${pageSize}`,
  );
  if (!data?.items) return [];
  return data.items.slice(0, pageSize).map((it) => ({
    hash: it.tx_hash ?? '',
    blockHeight: it.block_height ?? null,
    blockSignedAt: it.block_signed_at ?? null,
    from: it.from_address ?? null,
    to: it.to_address ?? null,
    value: it.value ?? '0',
    valueQuoteUSD: typeof it.value_quote === 'number' ? it.value_quote : null,
    feeQuoteUSD: typeof it.gas_quote === 'number' ? it.gas_quote : null,
    successful: it.successful !== false,
  }));
}

/**
 * Daily OHLCV-style series for a token from GoldRush historical pricing.
 * GoldRush endpoint: /pricing/historical_by_addresses_v2/{chainName}/USD/{addr}/
 *
 * IMPORTANT (no fabrication): GoldRush's token-address pricing endpoint returns
 * daily CLOSE prices ({date, price}) — it does not expose intraday high/low or
 * per-token volume. We therefore derive each candle from REAL closes only:
 * close = that day's price, open = previous day's real close, high/low = the
 * min/max of those two real values. Volume is left null (unknown), never invented.
 * Returns [] when unavailable.
 */
export async function getTokenOhlcv(
  chain: string,
  tokenAddress: string,
  opts: { days?: number } = {},
): Promise<OhlcvCandle[]> {
  const chainName = goldrushChainName(chain);
  if (!chainName || !tokenAddress) return [];
  const days = Math.min(Math.max(opts.days ?? 30, 1), 365);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  // Response is an array of contract items; we requested a single address.
  const data = await grGet<RawPricingResponse[]>(
    `/pricing/historical_by_addresses_v2/${chainName}/USD/${tokenAddress}/?from=${fromStr}&to=${toStr}`,
  );
  const prices = data?.[0]?.prices;
  if (!prices || prices.length === 0) return [];
  // GoldRush returns newest-first; sort ascending by date for a clean series.
  const points = prices
    .filter((p) => p.date && typeof p.price === 'number')
    .map((p) => ({ time: Math.floor(new Date(p.date as string).getTime() / 1000), price: p.price as number }))
    .sort((a, b) => a.time - b.time);
  return points.map((p, i) => {
    const open = i > 0 ? points[i - 1].price : p.price;
    const close = p.price;
    return {
      time: p.time,
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      volume: null, // GoldRush pricing endpoint does not supply per-token volume
    };
  });
}

/**
 * Latest spot USD price for a token (most recent historical price point).
 * Returns null when unavailable.
 */
export async function getTokenSpotPrice(chain: string, tokenAddress: string): Promise<number | null> {
  const chainName = goldrushChainName(chain);
  if (!chainName || !tokenAddress) return null;
  const to = new Date();
  const from = new Date(to.getTime() - 3 * 86_400_000); // small window → newest price
  const data = await grGet<RawPricingResponse[]>(
    `/pricing/historical_by_addresses_v2/${chainName}/USD/${tokenAddress}/?from=${from
      .toISOString()
      .slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`,
  );
  const prices = data?.[0]?.prices;
  if (!prices || prices.length === 0) return null;
  // Newest-first: first entry with a real price is the latest spot.
  for (const p of prices) {
    if (typeof p.price === 'number') return p.price;
  }
  return null;
}
