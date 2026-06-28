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

import { normalizeAddress } from '@/lib/utils/addressNormalize';

export interface FilterableEvent {
  id: string;
  type: string;
  sentiment: string;
  trustScore: number;
  valueUsd: number;
  tokenMarketCap?: number;
  tokenVolume24h?: number;
  tokenSymbol?: string;
  chain?: string;
  platform?: string;
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
  /** Keep a low-mcap token anyway when its 24h volume clears this floor —
   *  real activity (a fresh coin pumping) shouldn't be hidden by the mcap
   *  gate. 0 disables the volume escape hatch. */
  minVolume?: number;
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

// Ethereum is the platform's primary chain — it should dominate the feed, with
// the other chains mixed in (not a pump.fun / Solana flood). These additive
// weights bias ranking by chain without excluding anything.
const CHAIN_WEIGHT: Record<string, number> = {
  ethereum: 35,
  base: 18,
  arbitrum: 15,
  optimism: 13,
  bsc: 12,
  polygon: 10,
  avalanche: 10,
  solana: 6,
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

  // Chain bias (ETH-first) + a penalty for pump.fun so it can't flood the feed.
  const chainAdj = CHAIN_WEIGHT[(event.chain ?? '').toLowerCase()] ?? 4;
  const pumpPenalty = (event.platform ?? '').toLowerCase().includes('pump') ? -45 : 0;

  let personalBoost = 0;
  if (personal) {
    if (event.tokenSymbol && personal.watchlistSymbols.has(event.tokenSymbol.toUpperCase())) {
      personalBoost += 40;
    }
    // normalizeAddress (shape-based): lowercases EVM, preserves Solana base58 —
    // matches how followedAddresses is keyed so a followed Solana whale's events
    // get boosted too, without folding a case-sensitive base58 address.
    if (event.from && personal.followedAddresses.has(normalizeAddress(event.from))) {
      personalBoost += 35;
    }
    if (event.to && personal.followedAddresses.has(normalizeAddress(event.to))) {
      personalBoost += 35;
    }
  }

  return typeBase + sentimentAdj + trust + usdLog + recencyAdj + chainAdj + pumpPenalty + personalBoost;
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
//
// Two content families:
//   • NEWS   = informational / "what's happening" stories — whale moves,
//     large transfers, network activity, big-cap swings, rug alerts. These
//     are NOT coin-discovery cards; the News pill must show only these.
//   • COINS  = discovery — tradable tokens trending / launching / listing /
//     pumping. This is what the default feed should be mostly made of.
//
// `volume` is intentionally NOT a type list — it's metric-based (24h volume)
// and resolved by matchesEventFilter below. The entry here is only a fallback
// for type-only call sites (it reuses the coin discovery set).
const FILTER_TYPE_MAP: Record<Exclude<ContextTypeFilter, 'all'>, readonly string[]> = {
  news:      ['whale_transfer', 'token_transfer', 'whale_accumulation', 'whale_sell', 'large_transfer', 'network_activity', 'rug_alert', 'smart_money'],
  coins:     ['trending', 'token_launch', 'new_listing', 'trade'],
  new_coins: ['token_launch', 'new_listing'],
  volume:    ['trending', 'token_launch', 'new_listing', 'trade'],
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

// Minimum 24h volume (USD) for an event to qualify under the "Volume" pill.
// The string-matching approach surfaced ~3 events; this metric-based gate
// surfaces every genuinely-traded coin and the route sorts them by volume.
export const VOLUME_PILL_FLOOR = 25_000;

/**
 * Full-event filter — like matchesTypeFilter but can read metrics. The
 * "volume" pill is metric-based (real 24h volume), everything else delegates
 * to the type matcher. Used by the API route so each pill returns the right
 * set instead of the client double-filtering with stale string predicates.
 */
export function matchesEventFilter(
  e: { type?: string; tokenVolume24h?: number },
  filter: ContextTypeFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'volume') return (e.tokenVolume24h ?? 0) >= VOLUME_PILL_FLOOR;
  return matchesTypeFilter(e.type, filter);
}

export function applyContextFilter<T extends FilterableEvent>(
  events: T[],
  opts: FilterOptions = {},
): T[] {
  const minMcap = opts.minMarketCap ?? 500_000;
  const minVol = opts.minVolume ?? 0;
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
      if (e.tokenMarketCap >= minMcap) return true;
      // Low mcap but real traded volume — a fresh coin actually moving. Keep
      // it rather than hiding the exact "things happening" the feed is for.
      if (minVol > 0 && (e.tokenVolume24h ?? 0) >= minVol) return true;
      return false;
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
