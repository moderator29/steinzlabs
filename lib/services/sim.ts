import 'server-only';

/**
 * §5.10 Sim by Dune client. LOCKED env var: SIM_API_KEY (per
 * SESSION-T-KICKOFF §0.5 + steinz_labs_dune_sim_env_names memory).
 *
 * Sim is Dune's separate-billing live wallet API: portfolio aggregation
 * across EVM + Solana, post-trade smart-money cohort notifications,
 * watchlist webhooks. Compute units are billed independently from Dune
 * Analytics queries.
 *
 * Endpoint base: https://api.sim.dune.com/v1
 * Docs: https://docs.sim.dune.com/
 */

const BASE = 'https://api.sim.dune.com/v1';

export function isSimConfigured(): boolean {
  return Boolean(process.env.SIM_API_KEY);
}

async function fetchSim<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  const key = process.env.SIM_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'X-Sim-API-Key': key,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface SimBalance {
  chain: string;
  symbol: string;
  name?: string;
  address?: string;
  amount: string;
  usd_value?: number;
}

export interface SimPortfolio {
  wallet: string;
  total_usd: number;
  balances: SimBalance[];
}

/**
 * Cross-chain portfolio aggregation. Returns balances + USD totals
 * across every chain Sim covers for the given wallet.
 */
export async function getSimPortfolio(wallet: string): Promise<SimPortfolio | null> {
  const json = await fetchSim<{ wallet?: string; total_usd?: number; balances?: SimBalance[] }>(
    `/wallet/${wallet}/balances`,
  );
  if (!json) return null;
  return {
    wallet,
    total_usd: json.total_usd ?? 0,
    balances: json.balances ?? [],
  };
}

export interface SimRecentTrade {
  chain: string;
  tx_hash: string;
  block_time: string;
  side: 'buy' | 'sell';
  token_in: { address: string; symbol?: string; amount: string };
  token_out: { address: string; symbol?: string; amount: string };
  usd_value?: number;
}

/**
 * Recent trades feed for a wallet, aggregated across EVM + Solana.
 */
export async function getSimRecentTrades(wallet: string, limit = 50): Promise<SimRecentTrade[]> {
  const json = await fetchSim<{ trades?: SimRecentTrade[] }>(`/wallet/${wallet}/trades?limit=${limit}`);
  return json?.trades ?? [];
}

/**
 * Register a watchlist webhook for post-trade smart-money cohort
 * notifications. Sim POSTs to our callback when any address in the
 * cohort trades.
 *
 * Owner provisions cohorts via Sim dashboard; this just registers the
 * callback URL on our side.
 */
export async function registerSimWatchlistWebhook(opts: { cohort_id: string; callback_url: string }): Promise<{ ok: boolean }> {
  const r = await fetchSim<{ id?: string }>('/webhooks', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
  return { ok: Boolean(r?.id) };
}
