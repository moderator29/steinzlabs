import 'server-only';
import type { RecentTrade } from '@/lib/market/types';

/**
 * Real per-trade tape via GeckoTerminal's public pool `/trades` endpoint.
 *
 * Why: DexScreener's free API only exposes aggregate hourly buy/sell COUNTS,
 * not individual swaps — so the Recent Trades panel either sat empty forever
 * or (in the dead TradeTerminal) fabricated entries with random wallet hex.
 * GeckoTerminal returns the last ~300 individual on-chain swaps per pool for
 * both EVM and Solana, no API key, with real tx hashes + maker addresses.
 *
 * Docs: https://api.geckoterminal.com/api/v2 — GET
 *   /networks/{network}/pools/{pool}/trades?trade_volume_in_usd_greater_than=N
 */

const GT_BASE = 'https://api.geckoterminal.com/api/v2';

// Our chain ids → GeckoTerminal network slugs (mirrors the chart route map).
const GT_NETWORK: Record<string, string> = {
  ethereum: 'eth',
  eth: 'eth',
  bnb: 'bsc',
  bsc: 'bsc',
  polygon: 'polygon_pos',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avax',
  fantom: 'ftm',
  solana: 'solana',
};

export function geckoNetworkFor(chain: string): string | null {
  return GT_NETWORK[chain.toLowerCase()] ?? null;
}

interface GtTradeAttributes {
  block_timestamp?: string;
  kind?: 'buy' | 'sell';
  price_to_in_usd?: string;
  price_from_in_usd?: string;
  volume_in_usd?: string;
  from_token_amount?: string;
  to_token_amount?: string;
  tx_hash?: string;
  tx_from_address?: string;
}

interface GtTradesResponse {
  data?: Array<{ id: string; type: string; attributes: GtTradeAttributes }>;
}

/**
 * Fetch recent real swaps for a pool. Returns newest-first, normalised to the
 * platform's RecentTrade shape. Returns [] (never throws) on any failure so
 * the caller surfaces an empty state rather than an error.
 *
 * @param minVolumeUsd drop dust trades below this USD size (default 0 = all).
 */
export async function getPoolTrades(
  chain: string,
  poolAddress: string,
  minVolumeUsd = 0,
): Promise<RecentTrade[]> {
  const network = geckoNetworkFor(chain);
  if (!network || !poolAddress) return [];

  const url =
    `${GT_BASE}/networks/${network}/pools/${poolAddress.toLowerCase()}/trades` +
    (minVolumeUsd > 0 ? `?trade_volume_in_usd_greater_than=${minVolumeUsd}` : '');

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json;version=20230302' },
      signal: AbortSignal.timeout(8000),
      // GeckoTerminal updates trades ~every block; a short revalidate keeps
      // us within their 30 req/min free limit while staying near-live.
      next: { revalidate: 10 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as GtTradesResponse;
    const rows = json.data ?? [];

    const trades: RecentTrade[] = [];
    for (const row of rows) {
      const a = row.attributes;
      const type: 'buy' | 'sell' = a.kind === 'sell' ? 'sell' : 'buy';
      const valueUSD = parseFloat(a.volume_in_usd ?? '0');
      if (!Number.isFinite(valueUSD) || valueUSD < minVolumeUsd) continue;
      // Price of the traded token in USD — for a buy the token is the `to`
      // side, for a sell it's the `from` side.
      const price = parseFloat((type === 'buy' ? a.price_to_in_usd : a.price_from_in_usd) ?? '0');
      const amount = parseFloat((type === 'buy' ? a.to_token_amount : a.from_token_amount) ?? '0');
      const ts = a.block_timestamp ? Date.parse(a.block_timestamp) : 0;
      trades.push({
        timestamp: Number.isFinite(ts) ? ts : 0,
        type,
        price: Number.isFinite(price) ? price : 0,
        amount: Number.isFinite(amount) ? amount : 0,
        valueUSD,
        wallet: a.tx_from_address ?? '',
      });
    }
    return trades.sort((x, y) => y.timestamp - x.timestamp);
  } catch {
    return [];
  }
}
