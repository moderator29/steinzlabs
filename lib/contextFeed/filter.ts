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
  // CF3: per-user muted feed sources. Values are matched case-insensitive
  // against event.source / event.platform — e.g. {'biz', 'pumpfun',
  // 'helius'} hides every card those pipelines generated.
  mutedSources?: Set<string>;
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
  // Producers emit sentiment in UPPERCASE ("BULLISH"), but the weight keys
  // are lowercase — so this lookup silently scored every event as neutral.
  // Normalise the case so the sentiment weighting actually applies.
  const sentimentAdj = SENTIMENT_WEIGHT[event.sentiment?.toLowerCase()] ?? 0;
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

// ─── Shared event-type pill matcher ────────────────────────────────────────
// The UI exposes filter pills (news / coins / new_coins / volume / trending),
// but the source fetchers emit a DIFFERENT, underscored taxonomy
// (new_listing, token_launch, whale_accumulation, trade, trending,
// network_activity). Two call sites matched this independently and BOTH were
// wrong: the server route matched 'new-listing' (hyphen — no event has it) and
// 'coingecko'/'news' (no event emits them), so `news` and `new_coins` returned
// EMPTY; the archive page did `e.type.includes(pill)` which also never matched.
// This ONE matcher is the single source of truth — import it on both sides.
export type ContextTypeFilter = 'all' | 'news' | 'coins' | 'new_coins' | 'volume' | 'trending';

export const CONTEXT_TYPE_FILTERS: readonly ContextTypeFilter[] = [
  'all', 'news', 'coins', 'new_coins', 'volume', 'trending',
] as const;

// Pill → the canonical underscored event types it should surface.
const FILTER_TYPE_MAP: Record<Exclude<ContextTypeFilter, 'all'>, readonly string[]> = {
  news:      ['new_listing', 'trending', 'token_launch'],
  coins:     ['new_listing', 'token_launch', 'trade', 'trending'],
  new_coins: ['new_listing', 'token_launch'],
  volume:    ['whale_accumulation', 'whale_sell', 'large_transfer', 'trade'],
  trending:  ['trending'],
};

/**
 * Does an event of `type` belong under the given UI filter pill? Normalises
 * hyphens → underscores and any source prefix (e.g. `coingecko_trending`) so
 * the match is robust to taxonomy drift across fetchers.
 */
export function matchesTypeFilter(type: string | undefined, filter: ContextTypeFilter): boolean {
  if (filter === 'all') return true;
  const t = (type || '').toLowerCase().replace(/-/g, '_');
  return FILTER_TYPE_MAP[filter].some((allowed) => t.includes(allowed));
}

export function applyContextFilter<T extends FilterableEvent>(
  events: T[],
  opts: FilterOptions = {},
): T[] {
  const minMcap = opts.minMarketCap ?? 500_000;
  const muted = opts.personal?.mutedSources;
  const filtered = events.filter((e) => {
    // CF3: drop events whose source/platform the user explicitly muted.
    if (muted && muted.size > 0) {
      const src = (e as { source?: string; platform?: string }).source
        ?? (e as { platform?: string }).platform
        ?? '';
      if (src && muted.has(src.toLowerCase())) return false;
    }
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
