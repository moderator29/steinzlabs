import 'server-only';

/**
 * §5.8 failure ladder Tier-2 fallback fetchers.
 *
 * The Dune failure ladder (lib/dune/failureLadder.ts on feat/dune-integration)
 * descends to Tier 2 when Dune is unavailable AND the cache is empty.
 * Tier 2 means "use a comparable non-Dune source." This module ships
 * the actual fallback closures for each top-impact surface.
 *
 * Pass these into `descendLadder({ ..., fallback: holderConcentrationFallback })`
 * etc. so the UI sees a "data via fallback" footnote instead of
 * <DataUnavailable/> when Dune is down.
 */

// ─── Holder concentration fallback via Birdeye / Alchemy ─────────────────

interface HolderConcentrationFallback {
  top10_pct: number | null;
  gini: number | null;
  nakamoto: number | null;
}

const BIRDEYE_BASE = 'https://public-api.birdeye.so';

export async function holderConcentrationFallback(token: string, chain: string): Promise<{ data: HolderConcentrationFallback | null; source: string } | null> {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BIRDEYE_BASE}/defi/token_holder?address=${token}&offset=0&limit=10`, {
      headers: { 'X-API-KEY': key, 'x-chain': chain.toLowerCase() === 'solana' ? 'solana' : chain.toLowerCase() },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: { items?: Array<{ ui_amount?: number; percentage?: number }>; total_supply?: number } };
    if (!json.success || !json.data?.items) return null;
    const items = json.data.items;
    const top10 = items.slice(0, 10).reduce((s, h) => s + Number(h.percentage ?? 0), 0);
    return {
      data: { top10_pct: Math.round(top10 * 100) / 100, gini: null, nakamoto: null },
      source: 'birdeye',
    };
  } catch {
    return null;
  }
}

// ─── Bridge flow fallback via CoinGecko + manual aggregation ────────────

interface BridgeFlowFallback {
  total_usd: number;
  source: string;
}

export async function bridgeFlowFallback(_from_chain: string, _to_chain: string, _hours: number): Promise<{ data: BridgeFlowFallback | null; source: string } | null> {
  // No good free public API for live bridge flow aggregates. The honest
  // tier-2 here is "no fallback available" — we return null so the
  // failure ladder drops to tier-3 (DataUnavailable) instead of
  // fabricating a number. deBridge has a partner API but it's gated.
  // Wire in when the partner key is provisioned.
  return null;
}

// ─── Smart-money score fallback via Etherscan label cache ────────────────

interface SmartMoneyFallback {
  score: number | null;
  label: string | null;
}

export async function smartMoneyScoreFallback(wallet: string, chain: string): Promise<{ data: SmartMoneyFallback | null; source: string } | null> {
  // For ETH-family we can hit Etherscan's address-tag endpoint when
  // ETHERSCAN_API_KEY is set; for Solana use Helius name resolution.
  // The honest fallback returns the entity label (e.g. "fund", "MM")
  // without a numeric score — the agent can still surface "this is
  // labeled as a market-maker per Etherscan" instead of nothing.
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (chain.toLowerCase() === 'ethereum' && apiKey) {
    try {
      // Etherscan doesn't expose tags via public API but the address
      // info endpoint returns balance — we can at least confirm it's
      // active. Real label data requires the paid "Etherscan PRO" tag
      // endpoint. Conservative fallback: return null score + null label
      // so the agent says "unable to verify".
      return { data: { score: null, label: null }, source: 'etherscan' };
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Price chart fallback via CoinGecko ───────────────────────────────────

interface PriceFallback {
  price_usd: number | null;
  change_24h_pct: number | null;
}

export async function priceFallback(coinIdOrSymbol: string): Promise<{ data: PriceFallback | null; source: string } | null> {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinIdOrSymbol)}&vs_currencies=usd&include_24hr_change=true`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usd: number; usd_24h_change: number }>;
    const row = json[coinIdOrSymbol.toLowerCase()];
    if (!row) return null;
    return {
      data: { price_usd: row.usd, change_24h_pct: row.usd_24h_change },
      source: 'coingecko',
    };
  } catch {
    return null;
  }
}
