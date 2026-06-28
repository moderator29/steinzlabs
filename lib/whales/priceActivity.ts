import 'server-only';
import { getBirdeyeTokenOverview } from '@/lib/services/birdeye';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * USD pricing for whale_activity rows.
 *
 * whale_activity.value_usd was never populated (webhooks insert 0, the poll
 * cron inserts null, and no cron priced it), so the whale feed — which filters
 * value_usd >= minUsd — showed nothing. This module prices a row from its
 * token + amount using real price APIs:
 *   1. By contract via Birdeye (covers Solana + EVM by address).
 *   2. By symbol via CoinGecko simple price, for native transfers that have no
 *      token_address (ETH/SOL/BNB/...).
 * Returns null when the token can't be priced (never a fabricated number).
 */

const NATIVE_CG: Record<string, string> = {
  ETH: 'ethereum', WETH: 'ethereum',
  SOL: 'solana', WSOL: 'solana',
  BNB: 'binancecoin', WBNB: 'binancecoin',
  MATIC: 'matic-network', POL: 'matic-network',
  AVAX: 'avalanche-2', ARB: 'arbitrum', OP: 'optimism',
  BTC: 'bitcoin', WBTC: 'wrapped-bitcoin',
};

// Native asset CoinGecko id keyed by chain. Used only when a row has NO
// token_address (a native-coin move) and the symbol is missing or non-canonical
// (e.g. "Ether" instead of "ETH"), which left ~18k native rows unpriced. The
// chain unambiguously fixes the gas asset — L2s (base/arbitrum/optimism) settle
// in ETH. Never applied to a token_address row, so an unpriceable ERC-20 can't
// be mispriced as its chain's native coin.
const CHAIN_NATIVE_CG: Record<string, string> = {
  ethereum: 'ethereum', base: 'ethereum', arbitrum: 'ethereum', optimism: 'ethereum',
  solana: 'solana', bsc: 'binancecoin', polygon: 'matic-network',
  avalanche: 'avalanche-2', bitcoin: 'bitcoin',
};

const priceCache = new Map<string, { price: number; at: number }>();
const TTL = 60_000;

// GeckoTerminal (CoinGecko Onchain) network ids keyed by our chain slug. Free,
// keyless, prices any token by contract — the primary value_usd source.
const GT_NETWORK: Record<string, string> = {
  ethereum: 'eth', solana: 'solana', base: 'base', arbitrum: 'arbitrum',
  bsc: 'bsc', polygon: 'polygon_pos', optimism: 'optimism', avalanche: 'avax',
};

async function geckoTerminalPrice(chain: string, tokenAddress: string): Promise<number | null> {
  const network = GT_NETWORK[chain.toLowerCase()];
  if (!network) return null;
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/simple/networks/${network}/token_price/${tokenAddress}`,
      { headers: { accept: 'application/json' }, next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { attributes?: { token_prices?: Record<string, string> } } };
    const prices = json.data?.attributes?.token_prices ?? {};
    // GeckoTerminal lowercases EVM addresses in the response key; match loosely.
    const raw = prices[tokenAddress] ?? prices[tokenAddress.toLowerCase()] ?? Object.values(prices)[0];
    const price = raw != null ? parseFloat(raw) : NaN;
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// GeckoTerminal accepts up to 30 comma-separated addresses per request. Pricing
// the backlog one token at a time blew the ~30 req/min free limit and left a
// permanent NULL backlog; batching prices a whole chain's distinct tokens in a
// couple of requests. Returns a map keyed by the REQUESTED address (handles the
// API lowercasing EVM keys) → unit USD price.
const GT_MAX_PER_REQUEST = 30;

async function geckoTerminalPriceMany(
  chain: string,
  addresses: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const network = GT_NETWORK[chain.toLowerCase()];
  if (!network || addresses.length === 0) return out;
  for (let i = 0; i < addresses.length; i += GT_MAX_PER_REQUEST) {
    const chunk = addresses.slice(i, i + GT_MAX_PER_REQUEST);
    try {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/simple/networks/${network}/token_price/${chunk.join(',')}`,
        { headers: { accept: 'application/json' }, next: { revalidate: 60 } },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: { attributes?: { token_prices?: Record<string, string> } } };
      const prices = json.data?.attributes?.token_prices ?? {};
      // Build a lowercased view once so EVM (lowercased by GT) and Solana
      // (case-preserved) both resolve.
      const lower: Record<string, string> = {};
      for (const [k, v] of Object.entries(prices)) lower[k.toLowerCase()] = v;
      for (const addr of chunk) {
        const raw = prices[addr] ?? lower[addr.toLowerCase()];
        const price = raw != null ? parseFloat(raw) : NaN;
        if (Number.isFinite(price) && price > 0) out.set(addr, price);
      }
    } catch {
      /* skip this chunk; misses fall back to per-token pricing */
    }
  }
  return out;
}

async function tokenPriceUsd(
  chain: string,
  tokenAddress: string | null,
  symbol: string | null,
): Promise<number | null> {
  // 1. By contract. GeckoTerminal first (free, keyless, all chains), then
  //    Birdeye as fallback (CU-limited but good Solana depth).
  if (tokenAddress) {
    const key = `tok:${chain}:${normalizeAddress(tokenAddress, chain)}`;
    const cached = priceCache.get(key);
    if (cached && Date.now() - cached.at < TTL) return cached.price;
    const gt = await geckoTerminalPrice(chain, tokenAddress);
    if (gt != null) {
      priceCache.set(key, { price: gt, at: Date.now() });
      return gt;
    }
    try {
      const overview = await getBirdeyeTokenOverview(tokenAddress, chain);
      if (overview && overview.price > 0) {
        priceCache.set(key, { price: overview.price, at: Date.now() });
        return overview.price;
      }
    } catch { /* fall through to symbol pricing */ }
  }

  // 2. Native transfers via CoinGecko simple price. Resolve the CoinGecko id
  //    from the symbol first; if there's no token_address (a native-coin move)
  //    fall back to the chain's native asset so a missing/odd symbol doesn't
  //    leave it unpriced. The chain fallback is gated on `!tokenAddress` so a
  //    token whose contract simply couldn't be priced is never valued as ETH.
  if (symbol || !tokenAddress) {
    const id = (symbol ? NATIVE_CG[symbol.toUpperCase()] : undefined)
      ?? (!tokenAddress ? CHAIN_NATIVE_CG[chain.toLowerCase()] : undefined);
    if (id) {
      const key = `cg:${id}`;
      const cached = priceCache.get(key);
      if (cached && Date.now() - cached.at < TTL) return cached.price;
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
          { next: { revalidate: 60 } },
        );
        if (res.ok) {
          const json = (await res.json()) as Record<string, { usd?: number }>;
          const price = json[id]?.usd;
          if (typeof price === 'number' && price > 0) {
            priceCache.set(key, { price, at: Date.now() });
            return price;
          }
        }
      } catch { /* unpriceable */ }
    }
  }

  return null;
}

export interface ActivityToPrice {
  chain: string;
  token_address: string | null;
  token_symbol: string | null;
  amount: number | null;
}

/** Returns amount * USD price, or null when the token can't be priced. */
export async function priceActivityUsd(a: ActivityToPrice): Promise<number | null> {
  if (a.amount == null || a.amount <= 0) return null;
  const price = await tokenPriceUsd(a.chain, a.token_address, a.token_symbol);
  if (price == null) return null;
  return a.amount * price;
}

function tokenKey(a: ActivityToPrice): string {
  return a.token_address
    ? `${a.chain}:${normalizeAddress(a.token_address, a.chain)}`
    : `${a.chain}:sym:${(a.token_symbol ?? '').toUpperCase()}`;
}

/**
 * Price a batch of rows, looking up each distinct token's UNIT price exactly
 * once. Pricing N rows concurrently with priceActivityUsd would fire N parallel
 * identical lookups before the 60s cache populates (a thundering herd that
 * burns CoinGecko/Birdeye rate-limit on a batch full of ETH/USDC transfers).
 * This dedupes by token first, then multiplies per row. Returns value_usd
 * aligned to the input order (null where unpriceable).
 */
export async function priceActivityUsdBatch(items: ActivityToPrice[]): Promise<(number | null)[]> {
  const uniq = new Map<string, ActivityToPrice>();
  for (const a of items) {
    const k = tokenKey(a);
    if (!uniq.has(k)) uniq.set(k, a);
  }
  const unit = new Map<string, number | null>();

  // 1. Bulk-price token-address rows via GeckoTerminal's multi endpoint,
  //    grouped by chain (≤30 addresses/request). This is the throttle fix:
  //    a batch full of distinct ERC-20s now costs ~1 request per 30 tokens
  //    instead of one per token, so the backlog actually drains.
  const byChain = new Map<string, { key: string; address: string }[]>();
  for (const [k, a] of uniq) {
    if (a.token_address) {
      const list = byChain.get(a.chain) ?? [];
      list.push({ key: k, address: a.token_address });
      byChain.set(a.chain, list);
    }
  }
  for (const [chain, list] of byChain) {
    const priced = await geckoTerminalPriceMany(chain, list.map((x) => x.address));
    for (const { key, address } of list) {
      const p = priced.get(address);
      if (p != null) {
        unit.set(key, p);
        // Warm the per-token cache so inline poll/webhook pricing reuses it.
        const a = uniq.get(key)!;
        if (a.token_address) priceCache.set(`tok:${chain}:${normalizeAddress(a.token_address, chain)}`, { price: p, at: Date.now() });
      }
    }
  }

  // 2. Per-token fallback (Birdeye / CoinGecko / native) for anything the
  //    bulk call didn't resolve — natives with no token_address, or tokens
  //    GeckoTerminal doesn't list.
  for (const [k, a] of uniq) {
    if (unit.get(k) != null) continue;
    unit.set(k, await tokenPriceUsd(a.chain, a.token_address, a.token_symbol));
  }

  return items.map((a) => {
    if (a.amount == null || a.amount <= 0) return null;
    const p = unit.get(tokenKey(a));
    return p == null ? null : a.amount * p;
  });
}

/** Loosely-typed just-inserted whale_activity row for price-at-ingest. */
interface PersistableRow {
  chain?: unknown;
  token_address?: unknown;
  token_symbol?: unknown;
  amount?: unknown;
  tx_hash?: unknown;
  whale_address?: unknown;
  value_usd?: unknown;
}

/**
 * Price webhook-inserted whale_activity rows (which land at value_usd=0) and
 * persist the result, so real-time webhook flow is visible to the size-filtered
 * feed immediately instead of waiting on the half-hourly backfill. Mutates each
 * row's value_usd in place so a downstream consumer (e.g. the copy-trade
 * matcher) sees the real USD. Returns the count priced. Best-effort: a row that
 * can't be priced is left at 0 for the backfill cron to retry.
 */
export async function priceAndPersistWhaleRows(rows: PersistableRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = getSupabaseAdmin();
  // Price the whole batch deduping per-token (no herd), then persist each.
  const values = await priceActivityUsdBatch(
    rows.map((r) => ({
      chain: String(r.chain ?? ''),
      token_address: (r.token_address as string | null) ?? null,
      token_symbol: (r.token_symbol as string | null) ?? null,
      amount: typeof r.amount === 'number' ? r.amount : Number(r.amount),
    })),
  );
  let priced = 0;
  await Promise.all(
    rows.map(async (r, i) => {
      const value = values[i];
      const chain = String(r.chain ?? '');
      const txHash = String(r.tx_hash ?? '');
      const whaleAddress = String(r.whale_address ?? '');
      if (value == null || value <= 0 || !chain || !txHash || !whaleAddress) return;
      r.value_usd = value;
      const { error } = await sb
        .from('whale_activity')
        .update({ value_usd: value })
        .eq('tx_hash', txHash)
        .eq('whale_address', whaleAddress)
        .eq('chain', chain);
      if (!error) priced++;
    }),
  );
  return priced;
}
