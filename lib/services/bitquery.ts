import 'server-only';

/**
 * Bitquery — cross-chain smart-money discovery (the free replacement for the
 * retired Arkham integration). Queries recent large DEX buyers per chain and
 * returns their wallet addresses + USD volume so the whale-discovery cron can
 * UPSERT them into `whales` (which feeds both the whale tracker and the
 * /smart-money page).
 *
 * GATED: returns [] unless BITQUERY_API_KEY is set, so it's a harmless no-op
 * until you enable it. Per the whale-discovery cron's note, VERIFY the exact
 * GraphQL field names in Bitquery's playground (https://ide.bitquery.io) for
 * your plan before relying on the data — the EAP schema evolves. Any error /
 * unexpected shape fails closed (returns []) so we never write garbage.
 *
 * Endpoint + auth are env-overridable:
 *   BITQUERY_API_KEY       — required (v2 EAP OAuth access token)
 *   BITQUERY_ENDPOINT      — default https://streaming.bitquery.io/graphql
 */

const ENDPOINT = process.env.BITQUERY_ENDPOINT || 'https://streaming.bitquery.io/graphql';

// Our chain slug → Bitquery EAP `network` enum value.
const NETWORK_BY_CHAIN: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon: 'matic',
  bsc: 'bsc',
};

export interface DiscoveredTrader {
  address: string;
  chain: string;
  volumeUsd: number;
}

export function isBitqueryEnabled(): boolean {
  return !!process.env.BITQUERY_API_KEY;
}

/**
 * Top DEX buyers on `chain` since `sinceIso`, by USD volume. Returns at most
 * `limit` distinct EOA-shaped addresses. Fails closed (returns []).
 */
export async function getTopDexTraders(
  chain: string,
  opts: { sinceIso: string; minUsd?: number; limit?: number } = { sinceIso: '' },
): Promise<DiscoveredTrader[]> {
  const apiKey = process.env.BITQUERY_API_KEY;
  const network = NETWORK_BY_CHAIN[chain.toLowerCase()];
  if (!apiKey || !network || !opts.sinceIso) return [];

  const minUsd = opts.minUsd ?? 10_000;
  const limit = Math.min(opts.limit ?? 50, 100);

  // EAP DEXTrades aggregated by buyer. Field names per Bitquery v2 EAP — verify
  // in the playground for your plan; the parser below is defensive regardless.
  const query = `
    query TopTraders($network: evm_network, $since: DateTime, $minUsd: String) {
      EVM(network: $network) {
        DEXTrades(
          limit: { count: ${limit} }
          orderBy: { descendingByField: "volumeUsd" }
          where: { Block: { Time: { since: $since } }, Trade: { Buy: { AmountInUSD: { ge: $minUsd } } } }
        ) {
          Trade { Buy { Buyer } }
          volumeUsd: sum(of: Trade_Buy_AmountInUSD)
        }
      }
    }`;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables: { network, since: opts.sinceIso, minUsd: String(minUsd) },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows: unknown[] = json?.data?.EVM?.DEXTrades ?? [];
    if (!Array.isArray(rows)) return [];

    const out: DiscoveredTrader[] = [];
    const seen = new Set<string>();
    for (const r of rows as Array<Record<string, unknown>>) {
      const trade = r.Trade as Record<string, unknown> | undefined;
      const buy = trade?.Buy as Record<string, unknown> | undefined;
      const addr = String((buy?.Buyer ?? trade?.Buyer ?? '') as string).trim();
      // EVM EOA shape only; skip empties/contracts-as-zero.
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) continue;
      const lc = addr.toLowerCase();
      if (seen.has(lc)) continue;
      seen.add(lc);
      const volumeUsd = Number(r.volumeUsd ?? 0);
      out.push({ address: lc, chain: chain.toLowerCase(), volumeUsd: Number.isFinite(volumeUsd) ? volumeUsd : 0 });
    }
    return out;
  } catch {
    return [];
  }
}
