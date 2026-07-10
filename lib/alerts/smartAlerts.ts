import 'server-only';

/**
 * Server-side model + evaluators for the four Smart Alert types created on
 * /dashboard/alerts. These persist in the public.alerts table:
 *
 *   alert_type text   -- one of SMART_ALERT_TYPES below
 *   label      text   -- user-facing name
 *   condition  jsonb  -- the typed payload below (params + monitor cursor)
 *   active     boolean
 *   triggered  boolean
 *   triggered_at timestamptz
 *
 * The alerts table has no per-row "trigger count" / "last checked" columns, so
 * the monitor cursor (lastChecked / lastTxHash / triggerCount / lastTriggered)
 * lives inside condition.cursor. The alert-monitor cron reads these rows and
 * evaluates them against REAL free data sources (Etherscan-family explorers,
 * the public Solana RPC, pump.fun, and the unified CoinGecko price service).
 * Nothing here fabricates a number: when a source has no data the alert is
 * skipped and re-attempted on the next tick.
 */

import { isEvmAddress, isSolanaAddress, normalizeAddress, type Chain } from '@/lib/utils/addressNormalize';
import { getTokenPrice } from '@/lib/services/coingecko';
import { getDexPriceForChain } from '@/lib/services/dexscreener';
import { goldrushEnabled, goldrushSupportsChain, getTokenSpotPrice } from '@/lib/services/goldrush';
import { cacheGet } from '@/lib/cache/redis';

export const SMART_ALERT_TYPES = ['price', 'whale', 'launch', 'wallet_activity'] as const;
export type SmartAlertType = (typeof SMART_ALERT_TYPES)[number];

export type AlertChain = 'solana' | 'ethereum' | 'bsc' | 'base';
export const ALERT_CHAINS: AlertChain[] = ['solana', 'ethereum', 'bsc', 'base'];

/** Monitor cursor stored alongside the user params inside condition. */
export interface AlertCursor {
  lastChecked: number;
  lastTxHash?: string;
  triggerCount: number;
  lastTriggered?: number;
}

export interface PriceCondition {
  tokenId: string;
  tokenSymbol: string;
  direction: 'above' | 'below';
  targetPrice: number;
  chain?: string | null;
  cursor: AlertCursor;
}

export interface WhaleCondition {
  walletAddress: string;
  threshold: number;
  chain: AlertChain;
  cursor: AlertCursor;
}

export interface WalletActivityCondition {
  walletAddress: string;
  chain: AlertChain;
  cursor: AlertCursor;
}

export interface LaunchCondition {
  minLiquidity: number;
  minHolders: number;
  chain: 'solana' | 'any';
  keywords: string[];
  cursor: AlertCursor;
}

export type AlertCondition =
  | ({ type: 'price' } & PriceCondition)
  | ({ type: 'whale' } & WhaleCondition)
  | ({ type: 'wallet_activity' } & WalletActivityCondition)
  | ({ type: 'launch' } & LaunchCondition);

export function emptyCursor(): AlertCursor {
  return { lastChecked: 0, triggerCount: 0 };
}

// ── Validation / normalization at the API boundary ──────────────────────────

function evmExplorerBase(chain: AlertChain): string {
  switch (chain) {
    case 'bsc': return 'https://api.bscscan.com/api';
    case 'base': return 'https://api.basescan.org/api';
    default: return 'https://api.etherscan.io/api';
  }
}

function explorerKey(chain: AlertChain): string {
  if (chain === 'bsc') return process.env.BSCSCAN_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? '';
  if (chain === 'base') return process.env.BASESCAN_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? '';
  return process.env.ETHERSCAN_API_KEY ?? '';
}

/** CoinGecko id for the native asset of a chain (for whale USD valuation). */
function nativeCoinId(chain: AlertChain): string {
  switch (chain) {
    case 'bsc': return 'binancecoin';
    case 'solana': return 'solana';
    default: return 'ethereum'; // ethereum + base both use ETH
  }
}

/**
 * Live native-asset price in USD, from the unified CoinGecko service (shared
 * cache + usage counter). Returns null when the source has no price so callers
 * skip rather than valuing a transfer with a fabricated rate.
 */
export async function nativePriceUsd(chain: AlertChain): Promise<number | null> {
  try {
    const p = await getTokenPrice(nativeCoinId(chain));
    return typeof p === 'number' && p > 0 ? p : null;
  } catch {
    return null;
  }
}

// ── Evaluation result ───────────────────────────────────────────────────────

export interface AlertFire {
  message: string;
  /** When true, this is a one-shot alert and should be deactivated after firing. */
  oneShot: boolean;
}

export interface EvalResult {
  fire: AlertFire | null;
  /** New cursor to persist (always, even when not fired, to advance lastChecked). */
  cursor: AlertCursor;
  /** True when the source was cold/unavailable: skip without stamping. */
  cold: boolean;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ── Price evaluation (reuses the warm price cache, falls back to service) ────

interface CachedPrice { price: number }

export async function evaluatePrice(c: PriceCondition): Promise<EvalResult> {
  let live: number | null = null;
  // EVM-contract-keyed price alerts aren't in the CG cache; resolve by id only
  // when it's a real CoinGecko id. Address-keyed price alerts are handled by
  // the price_alerts table path, so here tokenId is always a CG id.
  const cached = await cacheGet<CachedPrice>(`price:cg:${c.tokenId}`);
  if (cached && typeof cached.price === 'number') {
    live = cached.price;
  } else {
    try {
      const p = await getTokenPrice(c.tokenId);
      if (typeof p === 'number' && p > 0) live = p;
    } catch { /* cold */ }
  }
  if (live == null) return { fire: null, cursor: c.cursor, cold: true };

  const hits =
    (c.direction === 'above' && live >= c.targetPrice) ||
    (c.direction === 'below' && live <= c.targetPrice);
  if (!hits) return { fire: null, cursor: c.cursor, cold: false };

  const verb = c.direction === 'above' ? 'surpassed' : 'dropped below';
  const message =
    `${c.tokenSymbol.toUpperCase()} ${verb} $${c.targetPrice.toLocaleString()} · now $${live.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
  return {
    fire: { message, oneShot: true },
    cursor: { ...c.cursor, lastTriggered: Date.now(), triggerCount: c.cursor.triggerCount + 1 },
    cold: false,
  };
}

// ── EVM wallet evaluation (whale + wallet_activity) ─────────────────────────

interface EvmTx { hash: string; timeStamp: string; value: string }

async function fetchEvmTxs(address: string, chain: AlertChain): Promise<EvmTx[] | null> {
  const key = explorerKey(chain);
  const url = `${evmExplorerBase(chain)}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=5${key ? `&apikey=${key}` : ''}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = await res.json() as { status: string; result: unknown };
    if (data.status !== '1' || !Array.isArray(data.result)) return null;
    return data.result as EvmTx[];
  } catch {
    return null;
  }
}

// ERC-20 token transfers (tokentx). CRITICAL for whale valuation: an ERC-20
// transfer's native `value` field is 0, so it never appears in txlist with any
// USD weight. tokentx carries the token contract, symbol, decimals and raw
// amount we need to value the move at its REAL USD.
interface EvmTokenTx {
  hash: string;
  timeStamp: string;
  value: string;           // raw token amount (base units)
  tokenDecimal: string;
  contractAddress: string;
  tokenSymbol: string;
}

async function fetchEvmTokenTxs(address: string, chain: AlertChain): Promise<EvmTokenTx[] | null> {
  const key = explorerKey(chain);
  const url = `${evmExplorerBase(chain)}?module=account&action=tokentx&address=${address}&sort=desc&page=1&offset=20${key ? `&apikey=${key}` : ''}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = await res.json() as { status: string; result: unknown };
    // status '0' with an empty result means "no token transfers" (a real
    // negative), but Etherscan also returns '0' on rate-limit; either way we
    // treat a non-'1' status as "no token data this tick" and lean on txlist.
    if (data.status !== '1' || !Array.isArray(data.result)) return null;
    return data.result as EvmTokenTx[];
  } catch {
    return null;
  }
}

/**
 * Real USD value of an ERC-20 transfer. Never fabricates: prefers GoldRush spot
 * pricing when a key is configured and the chain is supported, otherwise falls
 * back to the platform's existing DexScreener chain-scoped price. Returns null
 * when NO source can price the token — the caller treats that transfer's USD as
 * unknown (it will not threshold-fire) rather than valuing it at $0 or guessing.
 */
async function tokenTransferUsd(chain: AlertChain, contractAddress: string, amount: number): Promise<number | null> {
  if (!contractAddress || !(amount > 0)) return null;
  if (goldrushEnabled() && goldrushSupportsChain(chain)) {
    const p = await getTokenSpotPrice(chain, contractAddress);
    if (p != null && p > 0) return amount * p;
  }
  try {
    const p = await getDexPriceForChain(contractAddress, chain);
    if (p > 0) return amount * p;
  } catch { /* unpriceable → unknown */ }
  return null;
}

async function fetchSolSignatures(address: string): Promise<Array<{ signature: string; blockTime: number | null }> | null> {
  const endpoint = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [address, { limit: 5 }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: Array<{ signature: string; blockTime: number | null }> };
    return data.result ?? null;
  } catch {
    return null;
  }
}

export async function evaluateWallet(
  c: WhaleCondition | WalletActivityCondition,
  kind: 'whale' | 'wallet_activity',
): Promise<EvalResult> {
  const threshold = kind === 'whale' ? (c as WhaleCondition).threshold : 0;
  const short = shortAddr(c.walletAddress);
  const lastChecked = c.cursor.lastChecked || 0;

  if (c.chain === 'solana') {
    const sigs = await fetchSolSignatures(c.walletAddress);
    if (sigs == null) return { fire: null, cursor: c.cursor, cold: true };
    const fresh = sigs.filter(s => ((s.blockTime ?? 0) * 1000) > lastChecked && s.signature !== c.cursor.lastTxHash);
    if (fresh.length === 0) {
      return { fire: null, cursor: { ...c.cursor, lastChecked: Date.now() }, cold: false };
    }
    const message = kind === 'whale'
      ? `Whale wallet ${short} has ${fresh.length} new transaction(s) on Solana`
      : `Wallet ${short} has new activity on Solana`;
    return {
      fire: { message, oneShot: false },
      cursor: { lastChecked: Date.now(), lastTxHash: sigs[0].signature, lastTriggered: Date.now(), triggerCount: c.cursor.triggerCount + 1 },
      cold: false,
    };
  }

  // EVM chains. Value BOTH native-coin transfers (txlist) AND ERC-20 token
  // transfers (tokentx). The previous version read only txlist, where an ERC-20
  // transfer's native `value` is 0 — so a $2M USDC/PEPE whale move was valued at
  // $0 and could never cross the USD threshold. We now merge both streams and
  // price each token transfer at its REAL USD (GoldRush → DexScreener).
  const [nativeTxs, tokenTxs] = await Promise.all([
    fetchEvmTxs(c.walletAddress, c.chain),
    fetchEvmTokenTxs(c.walletAddress, c.chain),
  ]);
  // Both sources cold → skip without stamping so we re-attempt next tick and
  // never decide on missing data. If at least one returned we proceed with it.
  if (nativeTxs == null && tokenTxs == null) return { fire: null, cursor: c.cursor, cold: true };

  // Native transfers are valued with a LIVE native price; never a hardcoded
  // rate. When the native price is cold we skip the whole tick (cold), matching
  // the prior behavior, rather than misjudging a native move's threshold.
  let nativeUsd: number | null = null;
  if (kind === 'whale') {
    nativeUsd = await nativePriceUsd(c.chain);
    if (nativeUsd == null) return { fire: null, cursor: c.cursor, cold: true };
  }

  // Merge into one newest-first candidate list. Each candidate carries its REAL
  // USD value, or null = unknown (an unpriceable token move — must NOT fire).
  interface Candidate { hash: string; timeMs: number; usd: number | null }
  const candidates: Candidate[] = [];
  for (const tx of nativeTxs ?? []) {
    const valueNative = parseInt(tx.value || '0') / 1e18;
    candidates.push({
      hash: tx.hash,
      timeMs: parseInt(tx.timeStamp) * 1000,
      usd: nativeUsd != null ? valueNative * nativeUsd : null,
    });
  }
  for (const tt of tokenTxs ?? []) {
    const timeMs = parseInt(tt.timeStamp) * 1000;
    if (kind === 'whale') {
      // Only price tokens for the USD-thresholded whale path.
      let amount = 0;
      try {
        const decimals = parseInt(tt.tokenDecimal || '18');
        amount = Number(BigInt(tt.value || '0')) / 10 ** (Number.isFinite(decimals) ? decimals : 18);
      } catch { amount = 0; }
      const usd = await tokenTransferUsd(c.chain, tt.contractAddress, amount);
      candidates.push({ hash: tt.hash, timeMs, usd });
    } else {
      // wallet_activity fires on ANY fresh transfer; USD is irrelevant.
      candidates.push({ hash: tt.hash, timeMs, usd: null });
    }
  }

  candidates.sort((a, b) => b.timeMs - a.timeMs);
  // Watermark advances to the newest transfer seen (native or token) so we
  // never re-scan it, regardless of which older transfer actually fired.
  const newestHash = candidates.length ? candidates[0].hash : c.cursor.lastTxHash;

  for (const cand of candidates) {
    if (cand.timeMs <= lastChecked) break;
    if (cand.hash === c.cursor.lastTxHash) break;

    if (kind === 'wallet_activity') {
      const message = `Wallet ${short} has new activity on ${c.chain.toUpperCase()}`;
      return {
        fire: { message, oneShot: false },
        cursor: { lastChecked: Date.now(), lastTxHash: newestHash, lastTriggered: Date.now(), triggerCount: c.cursor.triggerCount + 1 },
        cold: false,
      };
    }

    // whale: only a transfer with a KNOWN real USD value that clears the
    // threshold fires. An unpriceable token (usd == null) is skipped honestly —
    // we never value it at $0 to force a fire, nor fabricate a price.
    if (cand.usd != null && cand.usd >= threshold) {
      const message = `Whale wallet ${short} moved ~$${Math.round(cand.usd).toLocaleString()} on ${c.chain.toUpperCase()}`;
      return {
        fire: { message, oneShot: false },
        cursor: { lastChecked: Date.now(), lastTxHash: newestHash, lastTriggered: Date.now(), triggerCount: c.cursor.triggerCount + 1 },
        cold: false,
      };
    }
  }

  return { fire: null, cursor: { ...c.cursor, lastChecked: Date.now() }, cold: false };
}

// ── Launch evaluation (pump.fun newest coins) ───────────────────────────────

interface PumpCoin {
  name?: string; symbol?: string; mint?: string;
  created_timestamp?: number;
  usd_market_cap?: number; market_cap?: number;
  holder_count?: number; holders?: number;
}

let launchCache: { coins: PumpCoin[]; ts: number } | null = null;

async function fetchNewLaunches(): Promise<PumpCoin[] | null> {
  // Share one upstream fetch across all launch alerts in a single cron tick.
  if (launchCache && Date.now() - launchCache.ts < 20_000) return launchCache.coins;
  try {
    const res = await fetch('https://frontend-api.pump.fun/coins?sort=created_timestamp&order=DESC&limit=30', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const coins = await res.json();
    if (!Array.isArray(coins)) return null;
    launchCache = { coins: coins as PumpCoin[], ts: Date.now() };
    return launchCache.coins;
  } catch {
    return null;
  }
}

export async function evaluateLaunch(c: LaunchCondition): Promise<EvalResult> {
  const coins = await fetchNewLaunches();
  if (coins == null) return { fire: null, cursor: c.cursor, cold: true };

  const lastChecked = c.cursor.lastChecked || 0;
  const fresh = coins.filter(co => (co.created_timestamp || 0) > lastChecked);
  const latest = fresh.length ? Math.max(...fresh.map(co => co.created_timestamp || 0)) : lastChecked;

  for (const coin of fresh) {
    const liquidity = coin.usd_market_cap || coin.market_cap || 0;
    const holders = coin.holder_count || coin.holders || 0;
    if (liquidity < c.minLiquidity) continue;
    if (holders < c.minHolders) continue;
    if (c.keywords.length > 0) {
      const name = (coin.name || '').toLowerCase();
      const symbol = (coin.symbol || '').toLowerCase();
      const matched = c.keywords.some(k => name.includes(k.toLowerCase()) || symbol.includes(k.toLowerCase()));
      if (!matched) continue;
    }
    const mcapStr = liquidity >= 1e6 ? `$${(liquidity / 1e6).toFixed(1)}M` : `$${Math.round(liquidity / 1000)}K`;
    const ca = coin.mint ? ` · CA ${coin.mint.slice(0, 8)}…` : '';
    const message = `New token ${coin.name} (${(coin.symbol || '').toUpperCase()}) launched at ${mcapStr} market cap${ca}`;
    return {
      fire: { message, oneShot: false },
      cursor: { ...c.cursor, lastChecked: Math.max(latest, coin.created_timestamp || Date.now()), lastTriggered: Date.now(), triggerCount: c.cursor.triggerCount + 1 },
      cold: false,
    };
  }

  return { fire: null, cursor: { ...c.cursor, lastChecked: latest }, cold: false };
}

// ── Boundary helpers for the API route ──────────────────────────────────────

export interface ValidatedAlert {
  alert_type: SmartAlertType;
  label: string;
  condition: Record<string, unknown>;
}

/** Per-tick shared cache reset so each cron run fetches fresh launch data. */
export function resetLaunchCache(): void {
  launchCache = null;
}

export { isEvmAddress, isSolanaAddress, normalizeAddress };
export type { Chain };
