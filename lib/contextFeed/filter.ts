/**
 * Context Feed 3-layer filter.
 *
 * Layer 1: Market-cap gate. Drop events whose token market cap is below
 *   the minimum. Events without a known market cap pass through so we do not
 *   lose native-asset transfers (ETH, SOL, BTC, etc.).
 * Layer 2: Signal priority. Rank each event by type, sentiment, trust score,
 *   and USD value. Higher score = higher priority.
 * Layer 3: Personal boost. If the event's token or wallet appears in the
 *   caller's watchlist / follows, add a boost to surface it first.
 */

export interface FilterableEvent {
  id: string;
  type: string;
  sentiment: string;
  trustScore: number;
  valueUsd: number;
  tokenMarketCap?: number;
  tokenSymbol?: string;
  from?: string;
  to?: string;
  timestamp: string;
}

export interface PersonalContext {
  watchlistSymbols: Set<string>;
  followedAddresses: Set<string>;
}

export interface FilterOptions {
  minMarketCap?: number;
  personal?: PersonalContext;
}

const TYPE_WEIGHT: Record<string, number> = {
  whale_accumulation: 100,
  smart_money_buy: 95,
  rug_alert: 90,
  new_listing: 80,
  large_transfer: 70,
  token_launch: 65,
  whale_sell: 60,
  trade: 50,
};

const SENTIMENT_WEIGHT: Record<string, number> = {
  bullish: 15,
  neutral: 0,
  bearish: -5,
  critical: 25,
};

export function scoreEvent(event: FilterableEvent, personal?: PersonalContext): number {
  const typeBase = TYPE_WEIGHT[event.type] ?? 40;
  const sentimentAdj = SENTIMENT_WEIGHT[event.sentiment] ?? 0;
  const trust = Math.min(100, Math.max(0, event.trustScore)) * 0.5;
  const usdLog = event.valueUsd > 0 ? Math.log10(event.valueUsd) * 6 : 0;
  const recencyMs = Date.now() - new Date(event.timestamp).getTime();
  const recencyAdj = Math.max(0, 20 - recencyMs / 60_000); // 0–20, decays ~20 min

  let personalBoost = 0;
  if (personal) {
    if (event.tokenSymbol && personal.watchlistSymbols.has(event.tokenSymbol.toUpperCase())) {
      personalBoost += 40;
    }
    if (event.from && personal.followedAddresses.has(event.from.toLowerCase())) {
      personalBoost += 35;
    }
    if (event.to && personal.followedAddresses.has(event.to.toLowerCase())) {
      personalBoost += 35;
    }
  }

  return typeBase + sentimentAdj + trust + usdLog + recencyAdj + personalBoost;
}

export function applyContextFilter<T extends FilterableEvent>(
  events: T[],
  opts: FilterOptions = {},
): T[] {
  const minMcap = opts.minMarketCap ?? 500_000;
  const filtered = events.filter((e) => {
    if (typeof e.tokenMarketCap === "number" && e.tokenMarketCap > 0) {
      return e.tokenMarketCap >= minMcap;
    }
    return true; // unknown mcap — keep (native transfers)
  });

  const scored = filtered.map((e) => ({
    event: e,
    score: scoreEvent(e, opts.personal),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.event);
}
