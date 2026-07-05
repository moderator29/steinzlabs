import 'server-only';

// CoinMarketCap free ("Basic") plan client — env-gated, inert until
// COINMARKETCAP_API_KEY is set. The Basic plan gives ~10k credits/month
// (~333/day) against pro-api.coinmarketcap.com with the X-CMC_PRO_API_KEY
// header. We use it as an AUTHORITATIVE cross-check for listed tickers, not a
// hot-path primary — DexScreener/GeckoTerminal (keyless, CA-based) stay first
// for arbitrary on-chain tokens. CMC's unique value here:
//   • fully_diluted_market_cap (FDV) for LISTED tokens — Trust Wallet's search
//     API does not return FDV, so CMC fills that gap for majors/listed alts.
//   • cmc_rank + is a "verified/listed" signal (a token CMC ranks is real).
//   • official logo + metadata via /v2/cryptocurrency/info.
// Never fabricates: returns null when unconfigured, rate-limited, or unlisted.

const CMC_BASE = 'https://pro-api.coinmarketcap.com';

export function cmcConfigured(): boolean {
  return !!process.env.COINMARKETCAP_API_KEY;
}

// Short-lived in-process cache — the free plan is credit-metered, so we never
// hit CMC twice for the same symbol inside the TTL window.
interface CacheEntry { at: number; data: unknown }
const cache = new Map<string, CacheEntry>();
const TTL = 5 * 60 * 1000; // 5 min — CMC free data updates on the minute anyway

// Circuit breaker: after repeated failures (bad key, quota exhausted) stop
// calling for a cooldown so we don't burn latency on every request.
let failStreak = 0;
let cooldownUntil = 0;

async function cmcGet<T = unknown>(path: string, query: Record<string, string>): Promise<T | null> {
  const key = process.env.COINMARKETCAP_API_KEY;
  if (!key) return null;
  if (Date.now() < cooldownUntil) return null;

  const qs = new URLSearchParams(query).toString();
  const cacheKey = `${path}?${qs}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${CMC_BASE}${path}?${qs}`, {
      headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      // 429 = quota; 401 = bad key — both warrant a cooldown.
      if (res.status === 429 || res.status === 401) {
        failStreak += 1;
        if (failStreak >= 2) cooldownUntil = Date.now() + 10 * 60 * 1000;
      }
      return null;
    }
    failStreak = 0;
    const body = (await res.json()) as T;
    cache.set(cacheKey, { at: Date.now(), data: body });
    return body;
  } catch {
    failStreak += 1;
    if (failStreak >= 3) cooldownUntil = Date.now() + 5 * 60 * 1000;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface CmcQuote {
  symbol: string;
  name: string;
  slug: string | null;
  cmcId: number | null;
  cmcRank: number | null;
  price: number | null;
  marketCap: number | null;
  fdv: number | null;              // fully_diluted_market_cap — TW/DexScreener gap-filler
  volume24h: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseQuote(item: any): CmcQuote | null {
  if (!item) return null;
  const q = item.quote?.USD ?? {};
  return {
    symbol: String(item.symbol ?? ''),
    name: String(item.name ?? ''),
    slug: item.slug ?? null,
    cmcId: typeof item.id === 'number' ? item.id : null,
    cmcRank: typeof item.cmc_rank === 'number' ? item.cmc_rank : null,
    price: typeof q.price === 'number' ? q.price : null,
    marketCap: typeof q.market_cap === 'number' && q.market_cap > 0 ? q.market_cap : null,
    fdv: typeof q.fully_diluted_market_cap === 'number' && q.fully_diluted_market_cap > 0 ? q.fully_diluted_market_cap : null,
    volume24h: typeof q.volume_24h === 'number' ? q.volume_24h : null,
    change1h: typeof q.percent_change_1h === 'number' ? q.percent_change_1h : null,
    change24h: typeof q.percent_change_24h === 'number' ? q.percent_change_24h : null,
    change7d: typeof q.percent_change_7d === 'number' ? q.percent_change_7d : null,
    circulatingSupply: typeof item.circulating_supply === 'number' ? item.circulating_supply : null,
    totalSupply: typeof item.total_supply === 'number' ? item.total_supply : null,
    maxSupply: typeof item.max_supply === 'number' ? item.max_supply : null,
  };
}

/**
 * Authoritative quote for a LISTED ticker (majors + CMC-listed alts). Returns
 * null for tokens CMC doesn't list (use DexScreener/GeckoTerminal for those).
 * When multiple coins share a symbol, CMC returns them keyed by symbol as an
 * array — we take the highest-rank (lowest cmc_rank) to avoid scam namesakes.
 */
export async function cmcQuoteBySymbol(symbol: string): Promise<CmcQuote | null> {
  const sym = symbol.replace(/^\$/, '').toUpperCase().trim();
  if (!sym || !cmcConfigured()) return null;
  const body = await cmcGet<{ data?: Record<string, any> }>('/v1/cryptocurrency/quotes/latest', { symbol: sym }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const entry = body?.data?.[sym];
  const arr = Array.isArray(entry) ? entry : entry ? [entry] : [];
  const ranked = arr
    .map(parseQuote)
    .filter((q): q is CmcQuote => !!q)
    .sort((a, b) => (a.cmcRank ?? 1e9) - (b.cmcRank ?? 1e9));
  return ranked[0] ?? null;
}

export interface CmcMeta {
  symbol: string;
  name: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  // Per-platform contract addresses CMC knows about (chain slug → address).
  contracts: Array<{ platform: string; address: string }>;
}

/** Official logo + metadata + known contract addresses for a listed ticker. */
export async function cmcMetaBySymbol(symbol: string): Promise<CmcMeta | null> {
  const sym = symbol.replace(/^\$/, '').toUpperCase().trim();
  if (!sym || !cmcConfigured()) return null;
  const body = await cmcGet<{ data?: Record<string, any> }>('/v2/cryptocurrency/info', { symbol: sym, aux: 'logo,urls,description,platform' }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const entry = body?.data?.[sym];
  const item = Array.isArray(entry) ? entry[0] : entry;
  if (!item) return null;
  const contracts: Array<{ platform: string; address: string }> = [];
  // contract_address is an array on v2 info; platform is the single native one.
  if (Array.isArray(item.contract_address)) {
    for (const c of item.contract_address) {
      const plat = c?.platform?.coin?.slug || c?.platform?.name;
      if (plat && c?.contract_address) contracts.push({ platform: String(plat), address: String(c.contract_address) });
    }
  }
  if (item.platform?.token_address) {
    contracts.push({ platform: String(item.platform?.slug || item.platform?.name || ''), address: String(item.platform.token_address) });
  }
  return {
    symbol: String(item.symbol ?? sym),
    name: String(item.name ?? ''),
    logo: typeof item.logo === 'string' ? item.logo : null,
    description: typeof item.description === 'string' ? item.description : null,
    website: Array.isArray(item.urls?.website) ? (item.urls.website[0] ?? null) : null,
    contracts,
  };
}
