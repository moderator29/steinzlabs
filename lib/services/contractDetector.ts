import 'server-only';
import { getTokenSecurity, getAddressSecurity } from '@/lib/services/goplus';
import {
  getHoneypotSimulation,
  honeypotSupported,
  type HoneypotResult,
} from '@/lib/services/honeypot';
import { getTokenPairs, type DexPair } from '@/lib/services/dexscreener';
import { getNewEvmPairs } from '@/lib/services/geckoterminal';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { detectLaunchpad, launchpadLabel } from '@/lib/sniper/launchpads';
import {
  isEvmAddress,
  isSolanaAddress,
  isEvmChain,
  normalizeAddress,
  addressesEqual,
} from '@/lib/utils/addressNormalize';
import type { TokenSecurityResult, AddressScanResult } from '@/lib/services/goplus';

/**
 * Shared deep contract detector.
 *
 * Resolves a single contract/token from MULTIPLE real providers in parallel
 * and merges them into one normalized view that both the Contract Analyzer
 * and (optionally) the DNA Analyzer can consume:
 *   - GoPlus token security  (honeypot, taxes, holders, mint/owner perms)
 *   - GoPlus address intel    (malicious / phishing / mixer / blacklist)
 *   - DexScreener pairs        (price, liq, vol, mc/fdv, socials, logo, age)
 *   - GeckoTerminal new pools  (market-data fallback for fresh EVM pools)
 *   - sniper_feed_tokens row   (launchpad + freshness when already ingested)
 *
 * Real data only — every field originates from a provider or is omitted.
 */

// Thresholds (single source of truth — also documented in the route).
/** A pair younger than this is treated as "just launched" (too early). */
export const TOO_EARLY_AGE_MS = 15 * 60 * 1000; // ~15 minutes
/** Below this liquidity a brand-new token has no meaningful market yet. */
export const MIN_MEANINGFUL_LIQUIDITY_USD = 500;

export interface DetectedMarket {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  marketCap: number;
  imageUrl?: string | null;
  symbol?: string;
  name?: string;
  url?: string | null;
  pairCreatedAt?: number | null;
  source: 'dexscreener' | 'geckoterminal';
  socials?: { twitter?: string; telegram?: string; website?: string } | null;
}

export interface DetectedFeed {
  launchpad: string | null;
  launchpadLabel: string;
  firstSeenAt: string | null;
  poolCreatedAt: string | null;
  holders?: number | null;
  bondingCurvePct?: number | null;
  socials?: { twitter?: string; telegram?: string; website?: string } | null;
  securityScore?: number | null;
}

export interface DetectorResult {
  address: string;
  chain: string;
  /** false → invalid / unknown contract on this chain (no data anywhere). */
  found: boolean;
  reason?: 'invalid_or_unknown';
  /** true → exists but brand-new, limited data so far. */
  tooEarly?: boolean;
  /** Approx token/pair age in ms when known. */
  ageMs?: number | null;
  token: TokenSecurityResult | null;
  addr: AddressScanResult | null;
  market: DetectedMarket | null;
  feed: DetectedFeed | null;
  /**
   * Live buy/sell simulation from Honeypot.is (FREE, no-key, EVM-only).
   * Independent second opinion to GoPlus's static honeypot flag. null on
   * Solana / unsupported chains; `available: false` inside on EVM when the
   * provider could not simulate (no pair / error).
   */
  honeypot: HoneypotResult | null;
}

function extractSocials(
  pair: DexPair | null,
): { twitter?: string; telegram?: string; website?: string } | null {
  if (!pair?.info) return null;
  const out: { twitter?: string; telegram?: string; website?: string } = {};
  const website = pair.info.websites?.[0]?.url;
  if (website) out.website = website;
  for (const s of pair.info.socials ?? []) {
    const type = (s.type || '').toLowerCase();
    if (type.includes('twitter') || type === 'x') out.twitter = s.url;
    else if (type.includes('telegram')) out.telegram = s.url;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Pick the highest-liquidity pair whose base token matches the queried address. */
function pickBestPair(pairs: DexPair[], address: string, chain: string): DexPair | null {
  if (pairs.length === 0) return null;
  const matches = pairs.filter((p) =>
    addressesEqual(p.baseToken?.address ?? '', address, chain),
  );
  const pool = matches.length > 0 ? matches : pairs;
  return pool
    .slice()
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function pairToMarket(
  pair: DexPair,
  source: DetectedMarket['source'],
): DetectedMarket {
  return {
    price: parseFloat(String(pair.priceUsd ?? '0')) || 0,
    priceChange24h: pair.priceChange?.h24 ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    fdv: pair.fdv ?? 0,
    marketCap: pair.marketCap ?? pair.fdv ?? 0,
    imageUrl: pair.info?.imageUrl ?? null,
    symbol: pair.baseToken?.symbol,
    name: pair.baseToken?.name,
    url: pair.url ?? null,
    pairCreatedAt: pair.pairCreatedAt ?? null,
    source,
    socials: extractSocials(pair),
  };
}

/** Validate the address format for the given chain. */
export function isValidAddressForChain(address: string, chain: string): boolean {
  const a = address.trim();
  if (!a) return false;
  if (isEvmChain(chain)) return isEvmAddress(a);
  if (chain.toLowerCase() === 'solana') return isSolanaAddress(a);
  // Unknown chain — accept either recognizable shape.
  return isEvmAddress(a) || isSolanaAddress(a);
}

async function fetchFeedRow(address: string, chain: string): Promise<DetectedFeed | null> {
  try {
    const sb = getSupabaseAdmin();
    const norm = normalizeAddress(address, chain);
    const { data } = await sb
      .from('sniper_feed_tokens')
      .select(
        'token_address, chain, launchpad, holders, bonding_curve_pct, socials, security_score, pool_created_at, first_seen_at',
      )
      .eq('chain', chain.toLowerCase())
      .or(`token_address.eq.${address},token_address.eq.${norm}`)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      launchpad: data.launchpad ?? null,
      launchpadLabel: launchpadLabel(data.launchpad),
      firstSeenAt: data.first_seen_at ?? null,
      poolCreatedAt: data.pool_created_at ?? null,
      holders: data.holders ?? null,
      bondingCurvePct: data.bonding_curve_pct ?? null,
      socials: data.socials ?? null,
      securityScore: data.security_score ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a contract from every available source and merge.
 * Determines the found / tooEarly / valid state per the documented thresholds.
 */
export async function detectContract(
  addressInput: string,
  chainInput: string,
): Promise<DetectorResult> {
  const address = addressInput.trim();
  const chain = (chainInput || 'ethereum').trim().toLowerCase();

  // 1. Address-format gate — fail fast for the wrong shape on this chain.
  if (!isValidAddressForChain(address, chain)) {
    return {
      address,
      chain,
      found: false,
      reason: 'invalid_or_unknown',
      token: null,
      addr: null,
      market: null,
      feed: null,
      honeypot: null,
    };
  }

  // 2. Pull every source in parallel. Honeypot.is is EVM-only — only fan it out
  //    when the address+chain are actually simulatable, otherwise skip cleanly.
  const honeypotPromise: Promise<HoneypotResult | null> = honeypotSupported(address, chain)
    ? getHoneypotSimulation(address, chain)
    : Promise.resolve(null);

  const [tokenScan, addressScan, dexScan, feedScan, honeypotScan] =
    await Promise.allSettled([
      getTokenSecurity(address, chain),
      getAddressSecurity(address, chain),
      getTokenPairs(address),
      fetchFeedRow(address, chain),
      honeypotPromise,
    ]);

  const token = tokenScan.status === 'fulfilled' ? tokenScan.value : null;
  const addr = addressScan.status === 'fulfilled' ? addressScan.value : null;
  const dexPairs = dexScan.status === 'fulfilled' ? dexScan.value : [];
  const feed = feedScan.status === 'fulfilled' ? feedScan.value : null;
  const honeypot = honeypotScan.status === 'fulfilled' ? honeypotScan.value : null;

  let bestPair = pickBestPair(dexPairs, address, chain);
  let market: DetectedMarket | null = bestPair ? pairToMarket(bestPair, 'dexscreener') : null;

  // 3. GeckoTerminal fallback for market data on fresh EVM pools that
  //    DexScreener hasn't indexed yet.
  if (!market && isEvmChain(chain)) {
    try {
      const gtPairs = await getNewEvmPairs(0, chain);
      const gtMatch = gtPairs.find((p) =>
        addressesEqual(p.baseToken?.address ?? '', address, chain),
      );
      if (gtMatch) {
        bestPair = gtMatch;
        market = pairToMarket(gtMatch, 'geckoterminal');
      }
    } catch {
      /* fallback best-effort */
    }
  }

  // 4. Decide the state. GoPlus returns an empty object for an unknown
  //    contract, which the parser turns into a default-scored result — so a
  //    populated `token` object alone does not prove the token exists. Require
  //    a real provider signal: a known holder count, a creator address, a
  //    populated raw payload, or any failed/non-default check.
  const rawKeys = token?.raw ? Object.keys(token.raw).filter((k) => k !== '_holders') : [];
  const hasSecurityRecord =
    !!token &&
    (rawKeys.length > 0 ||
      token.holderCount > 0 ||
      !!token.creatorAddress ||
      !!token.ownerAddress);
  const hasAddrIntel = !!addr && (addr.labels?.length > 0 || addr.riskScore > 0);
  const hasFeedRecord = !!feed;
  const hasMarket = !!market;
  // A successful Honeypot.is simulation is a real on-chain signal the token
  // exists and is tradable, even when GoPlus/DexScreener have no record yet.
  const hasHoneypotSim = !!honeypot && honeypot.available && honeypot.simulationSuccess;

  // INVALID — nothing anywhere.
  if (!hasSecurityRecord && !hasAddrIntel && !hasFeedRecord && !hasMarket && !hasHoneypotSim) {
    return {
      address,
      chain,
      found: false,
      reason: 'invalid_or_unknown',
      token: null,
      addr: null,
      market: null,
      feed: null,
      honeypot: null,
    };
  }

  // Age: prefer the pair age, then the feed pool/first-seen timestamps.
  const pairCreatedAt =
    market?.pairCreatedAt ??
    (feed?.poolCreatedAt ? Date.parse(feed.poolCreatedAt) : null) ??
    (feed?.firstSeenAt ? Date.parse(feed.firstSeenAt) : null);
  const ageMs = pairCreatedAt ? Date.now() - pairCreatedAt : null;

  const liquidity = market?.liquidity ?? 0;

  // TOO EARLY — exists, but brand-new: pair age under the window, OR no
  // tradable market data yet (no pair / negligible liquidity).
  const veryYoung = ageMs != null && ageMs < TOO_EARLY_AGE_MS;
  const noMarketYet = !hasMarket || liquidity < MIN_MEANINGFUL_LIQUIDITY_USD;
  const tooEarly = veryYoung || noMarketYet;

  return {
    address,
    chain,
    found: true,
    tooEarly,
    ageMs,
    token,
    addr,
    market,
    feed,
    honeypot,
  };
}
