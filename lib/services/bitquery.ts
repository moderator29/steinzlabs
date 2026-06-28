import 'server-only';

/**
 * Bitquery — cross-chain discovery of ACTIVE, day-to-day whale TRADERS (the free
 * replacement for the retired Arkham integration).
 *
 * We rank wallets by DEX trading VOLUME (not holdings) over a rolling window and
 * keep only ones that trade on most days and look like real individual traders,
 * not institutions/bots. The bitquery-traders cron applies the activity +
 * anti-institutional filters and UPSERTs survivors into `whales`, which feeds
 * the tracker, follow, watchlist, and copy-trade.
 *
 * GATED: returns [] unless BITQUERY_API_KEY is set, so it's a harmless no-op
 * until you enable it. The EAP GraphQL schema varies by plan — VERIFY the query
 * once in https://ide.bitquery.io before relying on it. Any error / unexpected
 * shape fails closed (returns []) so we never write garbage.
 *
 *   BITQUERY_API_KEY   — required (v2 EAP OAuth access token, "ory_at_…")
 *   BITQUERY_ENDPOINT  — default https://streaming.bitquery.io/graphql
 */

const ENDPOINT = process.env.BITQUERY_ENDPOINT || 'https://streaming.bitquery.io/graphql';

// Our chain slug → Bitquery EAP `network` enum value (EVM only). Solana is a
// separate top-level dataset, handled below.
const EVM_NETWORK_BY_CHAIN: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon: 'matic',
  bsc: 'bsc',
};

export interface ActiveTrader {
  address: string;
  chain: string;
  volumeUsd: number;
  trades: number;
  activeDays: number;
}

export function isBitqueryEnabled(): boolean {
  return !!process.env.BITQUERY_API_KEY;
}

async function bitqueryPost(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const apiKey = process.env.BITQUERY_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  return res.json();
}

const EVM_QUERY = `
  query ActiveEvmTraders($network: evm_network, $since: DateTime, $limit: Int) {
    EVM(network: $network) {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descendingByField: "volumeUsd" }
        where: { Block: { Time: { since: $since } } }
      ) {
        Trade { Buy { Buyer } }
        volumeUsd: sum(of: Trade_Buy_AmountInUSD)
        trades: count
        activeDays: uniq(of: Block_Date)
      }
    }
  }`;

const SOLANA_QUERY = `
  query ActiveSolanaTraders($since: DateTime, $limit: Int) {
    Solana {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descendingByField: "volumeUsd" }
        where: { Block: { Time: { since: $since } } }
      ) {
        Trade { Buy { Account { Owner } } }
        volumeUsd: sum(of: Trade_Buy_AmountInUSD)
        trades: count
        activeDays: uniq(of: Block_Date)
      }
    }
  }`;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Top DEX traders on `chain` since `sinceIso`, by USD volume, with trade count
 * and distinct active-day count so the caller can apply activity filters.
 * EVM-shaped 0x or Solana base58 only. Fails closed (returns []).
 */
export async function getActiveTraders(
  chain: string,
  opts: { sinceIso: string; limit?: number },
): Promise<ActiveTrader[]> {
  if (!isBitqueryEnabled() || !opts.sinceIso) return [];
  const c = chain.toLowerCase();
  const isSolana = c === 'solana';
  const network = isSolana ? null : EVM_NETWORK_BY_CHAIN[c];
  if (!isSolana && !network) return [];
  const limit = Math.min(opts.limit ?? 100, 200);

  try {
    const json = (await bitqueryPost(
      isSolana ? SOLANA_QUERY : EVM_QUERY,
      isSolana ? { since: opts.sinceIso, limit } : { network, since: opts.sinceIso, limit },
    )) as { data?: { EVM?: { DEXTrades?: unknown[] }; Solana?: { DEXTrades?: unknown[] } } } | null;

    const rows: unknown[] = (isSolana ? json?.data?.Solana?.DEXTrades : json?.data?.EVM?.DEXTrades) ?? [];
    if (!Array.isArray(rows)) return [];

    const out: ActiveTrader[] = [];
    const seen = new Set<string>();
    for (const r of rows as Array<Record<string, unknown>>) {
      const trade = r.Trade as Record<string, unknown> | undefined;
      const buy = trade?.Buy as Record<string, unknown> | undefined;
      const account = buy?.Account as Record<string, unknown> | undefined;
      const raw = String((isSolana ? account?.Owner : buy?.Buyer) ?? '').trim();
      const valid = isSolana
        ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)
        : /^0x[a-fA-F0-9]{40}$/.test(raw);
      if (!valid) continue;
      const dedupe = isSolana ? raw : raw.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        address: isSolana ? raw : raw.toLowerCase(),
        chain: c,
        volumeUsd: num(r.volumeUsd),
        trades: num(r.trades),
        activeDays: num(r.activeDays),
      });
    }
    return out;
  } catch {
    return [];
  }
}
