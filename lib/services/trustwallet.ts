import 'server-only';
import crypto from 'crypto';

// Trust Wallet developer-ecosystem integration (owner decision 2026-07-03).
// Two independent pieces:
//
//  1. ASSETS LOGO REGISTRY (no key, verifiable today) — the public
//     trustwallet/assets GitHub repo hosts token logos for ~180 chains at
//     raw.githubusercontent.com. Used as the universal logo BACKSTOP behind
//     Alchemy/DexScreener/GeckoTerminal images so any CA resolves with a
//     logo candidate. EVM paths require EIP-55 checksummed addresses.
//
//  2. API GATEWAY CLIENT (HMAC, env-gated) — tws.trustwallet.com free tier
//     (1 req/s) for token info / security second-opinions / trending. Auth:
//     HMAC-SHA256 over METHOD+PATH+QUERY+ACCESS_ID+NONCE+DATE, base64 in
//     Authorization, plus X-TW-Credential / X-TW-Nonce / X-TW-Date headers.
//     Fully inert until TWAK_ACCESS_ID + TWAK_HMAC_SECRET are set in env.
//     NOTE: concrete endpoint paths must be confirmed against
//     developer.trustwallet.com/developer/agent-sdk once the owner's key
//     exists — twGet() is the transport, callers own the paths.

const ASSET_CHAIN_DIRS: Record<string, string> = {
  ethereum: 'ethereum',
  bsc: 'smartchain',
  bnb: 'smartchain',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  base: 'base',
  optimism: 'optimism',
  avalanche: 'avalanchec',
  solana: 'solana',
  fantom: 'fantom',
  cronos: 'cronos',
  tron: 'tron',
};

/**
 * Ordered candidate logo URLs for a token — callers try them in order via
 * <img onError> fallthrough or a HEAD probe. Never fabricates: these are
 * real registry paths that either 200 or 404.
 */
export async function trustWalletAssetLogoUrl(
  chain: string,
  address: string,
): Promise<string | null> {
  const dir = ASSET_CHAIN_DIRS[chain.toLowerCase()];
  if (!dir) return null;
  let pathAddress = address;
  if (address.startsWith('0x')) {
    try {
      const { getAddress } = await import('ethers');
      pathAddress = getAddress(address.toLowerCase());
    } catch {
      return null; // invalid EVM address — no registry path exists
    }
  }
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${dir}/assets/${pathAddress}/logo.png`;
}

/** Native-coin / chain logo from the registry (info/logo.png). */
export function trustWalletChainLogoUrl(chain: string): string | null {
  const dir = ASSET_CHAIN_DIRS[chain.toLowerCase()];
  if (!dir) return null;
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${dir}/info/logo.png`;
}

// Real Trust Wallet Agent Kit gateway base — confirmed from the official
// @trustwallet/cli (TWAK) package, which signs HMAC requests against this host.
const TW_BASE = 'https://api.trustwallet.com';

export function twGatewayConfigured(): boolean {
  return !!(process.env.TWAK_ACCESS_ID && process.env.TWAK_HMAC_SECRET);
}

// Circuit breaker — if the gateway errors repeatedly (misconfigured key, wrong
// signed-string until validated, rate limit), stop calling for a cooldown so a
// not-yet-working TW never adds latency to the additive enrichment paths.
let twFailStreak = 0;
let twCooldownUntil = 0;
function twTripped(): boolean { return Date.now() < twCooldownUntil; }
function twNoteResult(ok: boolean): void {
  if (ok) { twFailStreak = 0; return; }
  twFailStreak += 1;
  if (twFailStreak >= 4) { twCooldownUntil = Date.now() + 5 * 60_000; twFailStreak = 0; }
}

/**
 * HMAC-signed request against the Trust Wallet API Gateway. Returns parsed JSON
 * or null (missing key, non-2xx, network failure) — callers MUST treat this as
 * ADDITIVE enrichment behind the primary providers, never a hard dependency.
 *
 * Auth (from the TWAK CLI): HMAC-SHA256 over METHOD+PATH+QUERY+ACCESS_ID+NONCE+
 * DATE, base64 in `Authorization: HMAC-SHA256 Signature=<sig>`, with
 * X-TW-CREDENTIAL (access id), X-TW-NONCE, X-TW-DATE, and X-TW-DEVICE-ID
 * (the agent id) headers. If the signed-string order needs a tweak once live,
 * it's isolated to this one function.
 */
export async function twGet<T = unknown>(path: string, query: Record<string, string> = {}): Promise<T | null> {
  const accessId = process.env.TWAK_ACCESS_ID;
  const secret = process.env.TWAK_HMAC_SECRET;
  const agentId = process.env.TWAK_AGENT_ID ?? '';
  if (!accessId || !secret || twTripped()) return null;
  try {
    const qs = new URLSearchParams(query).toString();
    const nonce = crypto.randomUUID();
    const date = new Date().toISOString();
    const payload = `GET${path}${qs}${accessId}${nonce}${date}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    const headers: Record<string, string> = {
      Authorization: `HMAC-SHA256 Signature=${signature}`,
      'X-TW-CREDENTIAL': accessId,
      'X-TW-NONCE': nonce,
      'X-TW-DATE': date,
      Accept: 'application/json',
    };
    if (agentId) headers['X-TW-DEVICE-ID'] = agentId;
    const res = await fetch(`${TW_BASE}${path}${qs ? `?${qs}` : ''}`, {
      headers,
      signal: AbortSignal.timeout(3500),
    });
    twNoteResult(res.ok);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    twNoteResult(false);
    return null;
  }
}

/**
 * Raw probe against a set of gateway endpoints — used by the admin probe route
 * to reveal live status + response SHAPES so the real price/security/swap
 * integrations can be wired against actual data (not guessed schemas). Bypasses
 * the circuit breaker and returns status + a small body sample per endpoint.
 */
export async function twProbe(paths: Array<{ path: string; query?: Record<string, string> }>): Promise<Array<{ path: string; status: number | string; sample: unknown }>> {
  const accessId = process.env.TWAK_ACCESS_ID;
  const secret = process.env.TWAK_HMAC_SECRET;
  const agentId = process.env.TWAK_AGENT_ID ?? '';
  if (!accessId || !secret) return [{ path: '(config)', status: 'missing TWAK_ACCESS_ID / TWAK_HMAC_SECRET', sample: null }];
  const out: Array<{ path: string; status: number | string; sample: unknown }> = [];
  for (const { path, query = {} } of paths) {
    try {
      const qs = new URLSearchParams(query).toString();
      const nonce = crypto.randomUUID();
      const date = new Date().toISOString();
      const signature = crypto.createHmac('sha256', secret).update(`GET${path}${qs}${accessId}${nonce}${date}`).digest('base64');
      const headers: Record<string, string> = {
        Authorization: `HMAC-SHA256 Signature=${signature}`,
        'X-TW-CREDENTIAL': accessId, 'X-TW-NONCE': nonce, 'X-TW-DATE': date, Accept: 'application/json',
      };
      if (agentId) headers['X-TW-DEVICE-ID'] = agentId;
      const res = await fetch(`${TW_BASE}${path}${qs ? `?${qs}` : ''}`, { headers, signal: AbortSignal.timeout(6000) });
      const text = await res.text();
      let body: unknown = text.slice(0, 1200);
      try { body = JSON.parse(text); } catch { /* keep text sample */ }
      out.push({ path, status: res.status, sample: body });
    } catch (e) {
      out.push({ path, status: 'fetch_error', sample: String(e).slice(0, 200) });
    }
  }
  return out;
}

// ─── Data helpers (asset info / search / trending) ──────────────────────────
// Built against the endpoints + response fields verified from the official
// @trustwallet/cli package (price, market_cap, price_change_24h, symbol,
// decimals, logoUrl, totalSupply, circulatingSupply). Every helper is ADDITIVE:
// returns null/[] on any miss so callers fall back to their existing source.
// The per-token assetId format (c{coinType}[_t{address}]) + exact asset path are
// TW's documented convention; if a live shape differs, twGet null-returns and
// the caller's primary serves — zero regression.

// Trust Wallet / SLIP-44 coin types for the chains we trade.
const TW_COIN_TYPE: Record<string, number> = {
  ethereum: 60, eth: 60,
  bsc: 20000714, bnb: 20000714, smartchain: 20000714,
  polygon: 966, matic: 966,
  avalanche: 10009000, avax: 10009000,
  arbitrum: 9001, optimism: 10, base: 8453,
  solana: 501, sol: 501,
  fantom: 250, cronos: 25, tron: 195,
};

export interface TwAsset {
  price: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logo: string | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  source: 'trustwallet';
}

function twAssetId(chain: string, address?: string | null): string | null {
  const coin = TW_COIN_TYPE[chain.toLowerCase()];
  if (coin == null) return null;
  return address ? `c${coin}_t${address}` : `c${coin}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number | null { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && isFinite(n) ? n : null; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTwAsset(x: any): TwAsset | null {
  if (!x || typeof x !== 'object') return null;
  const a = x.data ?? x.asset ?? x;
  const m = a.market ?? a;
  const price = num(m.price ?? m.price_usd ?? a.price);
  const symbol = a.symbol ?? a.ticker ?? null;
  if (price == null && !symbol) return null; // nothing usable
  return {
    price,
    priceChange24h: num(m.price_change_24h ?? m.priceChange ?? m.price_change_percentage_24h),
    marketCap: num(m.market_cap ?? m.marketCap),
    volume24h: num(m.volume_24h ?? m.volume),
    symbol,
    name: a.name ?? null,
    decimals: num(a.decimals),
    logo: a.logoUrl ?? a.logo ?? a.image ?? null,
    circulatingSupply: num(a.circulatingSupply ?? a.circulating_supply),
    totalSupply: num(a.totalSupply ?? a.total_supply),
    source: 'trustwallet',
  };
}

/** Real price + metadata for one token via the gateway. null when unavailable. */
export async function twAssetInfo(chain: string, address?: string | null): Promise<TwAsset | null> {
  const id = twAssetId(chain, address);
  if (!id) return null;
  // Try the id-path form first, then the query form — whichever the gateway
  // answers. Both null-return safely.
  const byPath = await twGet<unknown>(`/v1/assets/${encodeURIComponent(id)}`);
  const parsed = parseTwAsset(byPath);
  if (parsed) return parsed;
  const byQuery = await twGet<unknown>('/v1/assets', { ids: id });
  // batch shape: { data: [ ... ] } or [ ... ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr: any = byQuery;
  const first = Array.isArray(arr) ? arr[0] : Array.isArray(arr?.data) ? arr.data[0] : arr;
  return parseTwAsset(first);
}

export interface TwSearchHit { symbol: string; name: string; address: string | null; chain: string | null; logo: string | null }

/** Search assets by symbol/name. [] when unavailable. */
export async function twSearchAssets(query: string): Promise<TwSearchHit[]> {
  const body = await twGet<unknown>('/v1/search/assets', { query });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(body) ? body : Array.isArray((body as any)?.data) ? (body as any).data : (body as any)?.assets ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((r: any) => ({
    symbol: r.symbol ?? r.ticker ?? '',
    name: r.name ?? '',
    address: r.address ?? r.tokenAddress ?? null,
    chain: r.chain ?? r.network ?? null,
    logo: r.logoUrl ?? r.logo ?? null,
  })).filter((h: TwSearchHit) => h.symbol || h.address);
}

/** Trending / popular assets. [] when unavailable. */
export async function twPopularAssets(): Promise<TwSearchHit[]> {
  const body = await twGet<unknown>('/v1/assets/popular');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(body) ? body : Array.isArray((body as any)?.data) ? (body as any).data : (body as any)?.assets ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((r: any) => ({
    symbol: r.symbol ?? '', name: r.name ?? '', address: r.address ?? null,
    chain: r.chain ?? null, logo: r.logoUrl ?? r.logo ?? null,
  })).filter((h: TwSearchHit) => h.symbol || h.address);
}
