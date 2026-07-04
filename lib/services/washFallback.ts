import 'server-only';

/**
 * FREE wash-trade fallback (no key, all chains) for when the Dune
 * dune_wash_trade_score / dune_smart_money_token_flow tables are empty (free
 * Dune plan, or a chain Dune doesn't cover). Source: GeckoTerminal's public API
 * (top pools per network) — real 24h volume, liquidity, buyers/sellers per pool.
 *
 * Wash signal (real, transparent heuristic — no fabricated numbers):
 *   - turnover = 24h volume / liquidity. Organic tokens turn over ~0.1–8×/day;
 *     wash-traded tokens churn 30–1000× on thin liquidity.
 *   - trader concentration = trades per unique trader. A handful of wallets
 *     generating enormous volume back-and-forth is the classic wash pattern.
 * The output `washScore` is a 0–100 CLEANLINESS score (higher = cleaner) so it
 * slots into the exact same grade bands the Dune path uses.
 */

const GT_NETWORK: Record<string, string> = {
  ethereum: 'eth', base: 'base', arbitrum: 'arbitrum', optimism: 'optimism',
  bsc: 'bsc', polygon: 'polygon_pos', avalanche: 'avax', solana: 'solana',
};
// Chains scanned when the user picks "All chains".
const ALL_CHAINS = ['ethereum', 'bsc', 'base', 'solana', 'arbitrum', 'polygon'];

export interface WashFallbackToken {
  tokenAddress: string;
  chain: string;
  symbol: string | null;
  netInflowUsd: number;
  uniqueWallets: number;
  washScore: number;       // 0–100 cleanliness (higher = cleaner)
  flaggedPairs: number;    // count of wash signals that fired
  grade: 'clean' | 'caution' | 'wash' | 'unknown';
  source: 'geckoterminal';
}

function grade(score: number): WashFallbackToken['grade'] {
  if (score >= 80) return 'clean';
  if (score >= 50) return 'caution';
  return 'wash';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gt(path: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2${path}`, {
      headers: { Accept: 'application/json;version=20230302' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function washScoreFor(turnover: number, tradesPerTrader: number): { score: number; flags: number } {
  let penalty = 0;
  let flags = 0;
  // Turnover excess above a generous organic ceiling (8×/day).
  if (turnover > 8) { penalty += Math.min(70, (turnover - 8) * 1.8); flags += 1; }
  // Extreme churn from few wallets.
  if (tradesPerTrader > 12) { penalty += Math.min(25, (tradesPerTrader - 12) * 1.2); flags += 1; }
  // Both at once = textbook wash.
  if (turnover > 25 && tradesPerTrader > 20) { penalty += 10; flags += 1; }
  return { score: Math.max(0, Math.min(100, Math.round(100 - penalty))), flags };
}

async function fetchChain(chain: string): Promise<WashFallbackToken[]> {
  const network = GT_NETWORK[chain];
  if (!network) return [];
  // Top pools by 24h volume — where wash trading concentrates.
  const body = await gt(`/networks/${network}/pools?include=base_token&page=1`);
  if (!body?.data) return [];
  const tokenById = new Map<string, { address?: string; symbol?: string }>();
  for (const inc of body.included ?? []) {
    if (inc?.type === 'token') tokenById.set(inc.id, { address: inc.attributes?.address, symbol: inc.attributes?.symbol });
  }
  const out: WashFallbackToken[] = [];
  for (const pool of body.data as unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pool as any;
    const a = p.attributes ?? {};
    const liq = parseFloat(a.reserve_in_usd ?? '0') || 0;
    const vol24 = parseFloat(a.volume_usd?.h24 ?? '0') || 0;
    if (liq < 5000 || vol24 < 10000) continue; // ignore dust
    const tx = a.transactions?.h24 ?? {};
    const buys = Number(tx.buys ?? 0), sells = Number(tx.sells ?? 0);
    const buyers = Number(tx.buyers ?? 0), sellers = Number(tx.sellers ?? 0);
    const trades = buys + sells;
    const traders = Math.max(1, buyers + sellers);
    const turnover = vol24 / Math.max(liq, 1);
    const { score, flags } = washScoreFor(turnover, trades / traders);
    const baseId = p.relationships?.base_token?.data?.id;
    const base = baseId ? tokenById.get(baseId) : undefined;
    // Net USD flow proxy from buy/sell imbalance over real 24h volume.
    const netInflowUsd = trades > 0 ? Math.round(vol24 * ((buys - sells) / trades)) : 0;
    out.push({
      tokenAddress: base?.address ?? '',
      chain,
      symbol: base?.symbol ?? null,
      netInflowUsd,
      uniqueWallets: traders,
      washScore: score,
      flaggedPairs: flags,
      grade: grade(score),
      source: 'geckoterminal',
    });
  }
  return out.filter((t) => t.tokenAddress);
}

/** Free multi-chain wash-radar rows. `chain=null` scans the major chains. */
export async function washTradeFallback(chain: string | null): Promise<WashFallbackToken[]> {
  const chains = chain ? [chain] : ALL_CHAINS;
  const results = await Promise.all(chains.map((c) => fetchChain(c).catch(() => [])));
  return results.flat();
}
