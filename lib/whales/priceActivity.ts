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

const priceCache = new Map<string, { price: number; at: number }>();
const TTL = 60_000;

async function tokenPriceUsd(
  chain: string,
  tokenAddress: string | null,
  symbol: string | null,
): Promise<number | null> {
  // 1. By contract via Birdeye (Solana + EVM).
  if (tokenAddress) {
    const key = `be:${chain}:${normalizeAddress(tokenAddress, chain)}`;
    const cached = priceCache.get(key);
    if (cached && Date.now() - cached.at < TTL) return cached.price;
    try {
      const overview = await getBirdeyeTokenOverview(tokenAddress, chain);
      if (overview && overview.price > 0) {
        priceCache.set(key, { price: overview.price, at: Date.now() });
        return overview.price;
      }
    } catch { /* fall through to symbol pricing */ }
  }

  // 2. By symbol for native transfers via CoinGecko simple price.
  if (symbol) {
    const id = NATIVE_CG[symbol.toUpperCase()];
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
  let priced = 0;
  await Promise.all(
    rows.map(async (r) => {
      const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount);
      const chain = String(r.chain ?? '');
      const txHash = String(r.tx_hash ?? '');
      const whaleAddress = String(r.whale_address ?? '');
      if (!chain || !txHash || !whaleAddress || !Number.isFinite(amount)) return;
      const value = await priceActivityUsd({
        chain,
        token_address: (r.token_address as string | null) ?? null,
        token_symbol: (r.token_symbol as string | null) ?? null,
        amount,
      });
      if (value == null || value <= 0) return;
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
