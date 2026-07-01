import 'server-only';
import { getAddress, isAddress } from 'viem';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPoolsForIngest, getTokenInfo, SNIPER_FEED_CHAINS, type GtTokenInfo } from '@/lib/services/geckoterminal';
import { getTokensMulti, type DexPair } from '@/lib/services/dexscreener';
import { detectLaunchpad } from '@/lib/sniper/launchpads';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * Real-time new-token firehose ingester (#61).
 *
 * Polls GeckoTerminal new+trending pools across every supported chain (Solana
 * included — that's where the launchpads live), enriches logos/socials/stats
 * from DexScreener, detects the launchpad, and upserts normalized rows into
 * sniper_feed_tokens. The UI reads from that table (paginated, real-time,
 * hundreds of coins) instead of hitting rate-limited provider APIs per request.
 *
 * 100% real data — every row originates from a live provider. When a provider
 * is down, that chain simply contributes nothing this tick; nothing is faked.
 */

interface FeedRow {
  chain: string;
  token_address: string;
  pair_address: string | null;
  symbol: string | null;
  name: string | null;
  logo_url: string | null;
  launchpad: string;
  dex: string | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  fdv_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  txns_24h: number | null;
  price_change_24h: number | null;
  socials: { twitter?: string; telegram?: string; website?: string } | null;
  has_social: boolean;
  pool_created_at: string | null;
  updated_at: string;
}

function socialsFrom(info: DexPair['info']): FeedRow['socials'] {
  if (!info) return null;
  const out: { twitter?: string; telegram?: string; website?: string } = {};
  for (const s of info.socials ?? []) {
    const t = (s.type || '').toLowerCase();
    if (t.includes('twitter') || t === 'x') out.twitter = s.url;
    else if (t.includes('telegram')) out.telegram = s.url;
  }
  const site = info.websites?.[0]?.url;
  if (site) out.website = site;
  return Object.keys(out).length ? out : null;
}

/** A social handle can arrive as a bare handle ("@foo") or a full URL — normalize to a URL. */
function handleToUrl(base: string, handle: string): string {
  const h = handle.trim();
  if (/^https?:\/\//i.test(h)) return h;
  return base + h.replace(/^@/, '');
}

/**
 * Build the socials JSON from a GeckoTerminal token-info payload, matching the
 * shape `socialsFrom` produces. GT gives bare handles for twitter/telegram, so
 * they're expanded into canonical URLs; only real fetched values are used.
 */
function socialsFromTokenInfo(info: GtTokenInfo): FeedRow['socials'] {
  const out: { twitter?: string; telegram?: string; website?: string } = {};
  if (info.twitter) out.twitter = handleToUrl('https://x.com/', info.twitter);
  if (info.telegram) out.telegram = handleToUrl('https://t.me/', info.telegram);
  const site = info.websites?.find((w) => !!w);
  if (site) out.website = site;
  return Object.keys(out).length ? out : null;
}

// Our chain id → Trust Wallet asset-repo blockchain folder. Only EVM chains have
// a Trust Wallet path; anything absent here (e.g. solana) gets no fallback.
const TRUSTWALLET_CHAIN: Record<string, string> = {
  ethereum: 'ethereum',
  bsc: 'smartchain',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avalanchec',
  base: 'base',
};

/**
 * Last-resort logo: Trust Wallet's asset CDN, keyed by the EIP-55 checksummed
 * contract (the CDN paths are checksum-cased). This is a deterministic URL to a
 * real CDN — not fabricated data. The CDN 404s for tokens without art, which the
 * UI's <img> fallback handles. Returns null for non-EVM/invalid addresses.
 */
function trustWalletLogo(chain: string, address: string): string | null {
  const slug = TRUSTWALLET_CHAIN[chain];
  if (!slug || !isAddress(address)) return null;
  try {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${slug}/assets/${getAddress(address)}/logo.png`;
  } catch {
    return null;
  }
}

// Cap on GeckoTerminal token-info lookups per ingest run. Each is one request and
// the free tier is ~30 req/min (shared with the pool fetches), so this keeps a
// single tick well under the cap; positive results are cached 24h so subsequent
// ticks only spend budget on genuinely new tokens.
const TOKEN_INFO_BUDGET_PER_RUN = 20;

/** Merge a GeckoTerminal pool with its DexScreener pair (richer stats/socials). */
function toRow(chain: string, gt: DexPair, ds: DexPair | undefined, nowIso: string): FeedRow | null {
  const address = gt.baseToken.address;
  if (!address) return null;
  const best = ds ?? gt;
  const info = ds?.info ?? gt.info;
  const socials = socialsFrom(info);
  const txns24 = ds ? (ds.txns.h24.buys + ds.txns.h24.sells) : null;
  return {
    chain,
    token_address: address,
    pair_address: gt.pairAddress || ds?.pairAddress || null,
    symbol: best.baseToken.symbol || gt.baseToken.symbol || null,
    name: best.baseToken.name || gt.baseToken.name || null,
    logo_url: info?.imageUrl ?? null,
    launchpad: detectLaunchpad({ dex: gt.dexId || ds?.dexId, chain, tokenAddress: address }),
    dex: gt.dexId || ds?.dexId || null,
    price_usd: best.priceUsd ? parseFloat(best.priceUsd) || null : null,
    market_cap_usd: best.marketCap ?? gt.marketCap ?? null,
    fdv_usd: best.fdv ?? gt.fdv ?? null,
    liquidity_usd: best.liquidity?.usd ?? gt.liquidity?.usd ?? null,
    volume_24h_usd: ds?.volume?.h24 ?? gt.volume?.h24 ?? null,
    txns_24h: txns24,
    price_change_24h: ds?.priceChange?.h24 ?? null,
    socials,
    has_social: !!socials,
    pool_created_at: gt.pairCreatedAt ? new Date(gt.pairCreatedAt).toISOString() : null,
    updated_at: nowIso,
  };
}

export interface IngestResult {
  chains: number;
  fetched: number;
  upserted: number;
  perChain: Record<string, number>;
  errors: string[];
}

/**
 * Run one ingestion pass. `pagesPerChain` controls depth (each GT page ≈ 20
 * pools); 2 new + 1 trending ≈ 60 candidates/chain/tick, which accumulates into
 * hundreds of live rows across a few minutes without tripping the free rate cap.
 */
export async function ingestFeed(opts: { chains?: string[]; pagesPerChain?: number } = {}): Promise<IngestResult> {
  const chains = opts.chains ?? SNIPER_FEED_CHAINS;
  const pages = Math.max(1, Math.min(opts.pagesPerChain ?? 2, 5));
  const nowIso = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const result: IngestResult = { chains: chains.length, fetched: 0, upserted: 0, perChain: {}, errors: [] };
  let infoBudget = TOKEN_INFO_BUDGET_PER_RUN;

  for (const chain of chains) {
    try {
      // Freshest pools (new) + active pools (trending) for breadth.
      const batches = await Promise.all([
        ...Array.from({ length: pages }, (_, i) => getPoolsForIngest(chain, i + 1, 'new_pools')),
        getPoolsForIngest(chain, 1, 'trending_pools'),
      ]);
      const pools = batches.flat();

      // Dedup by token address (keep the newest occurrence).
      const byAddr = new Map<string, DexPair>();
      for (const p of pools) {
        const a = p.baseToken.address;
        if (a && !byAddr.has(a)) byAddr.set(a, p);
      }
      if (byAddr.size === 0) { result.perChain[chain] = 0; continue; }
      result.fetched += byAddr.size;

      // Enrich logos/socials/stats from DexScreener in batches of 30.
      const addrs = Array.from(byAddr.keys());
      // Pass chain so getTokensMulti keys the map via normalizeAddress(addr,
      // chain) — case-preserving for Solana. Look it up the same way (a raw
      // .toLowerCase() would miss every Solana mint).
      const dsMap = await getTokensMulti(addrs, chain).catch(() => new Map<string, DexPair>());

      const rows: FeedRow[] = [];
      for (const [addr, gt] of byAddr) {
        const row = toRow(chain, gt, dsMap.get(normalizeAddress(addr, chain)), nowIso);
        if (row) rows.push(row);
      }
      if (rows.length === 0) { result.perChain[chain] = 0; continue; }

      // Second-pass enrichment: brand-new tokens usually have no logo/socials in
      // either the GT pool payload or DexScreener. Pull the GT token /info
      // endpoint (CoinGecko-sourced) for rows still missing data, bounded by a
      // per-run budget so we stay under the ~30 req/min free cap.
      for (const r of rows) {
        if (infoBudget <= 0) break;
        if (r.logo_url && r.has_social) continue;
        infoBudget--;
        const info = await getTokenInfo(chain, r.token_address);
        if (!info) continue;
        if (!r.logo_url && info.imageUrl) r.logo_url = info.imageUrl;
        if (!r.has_social) {
          const s = socialsFromTokenInfo(info);
          if (s) { r.socials = s; r.has_social = true; }
        }
      }

      // Last-resort logo when every real source came up empty.
      for (const r of rows) {
        if (!r.logo_url) {
          const fallback = trustWalletLogo(chain, r.token_address);
          if (fallback) r.logo_url = fallback;
        }
      }

      const { error } = await sb
        .from('sniper_feed_tokens')
        .upsert(rows, { onConflict: 'chain,token_address', ignoreDuplicates: false });
      if (error) { result.errors.push(`${chain}: ${error.message}`); result.perChain[chain] = 0; continue; }
      result.upserted += rows.length;
      result.perChain[chain] = rows.length;
    } catch (e) {
      result.errors.push(`${chain}: ${e instanceof Error ? e.message : String(e)}`);
      result.perChain[chain] = 0;
    }
  }

  // Prune very stale rows so the feed stays "new" — drop anything not seen in
  // 6h (real launches age out; this keeps the table bounded without faking).
  const cutoff = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
  await sb.from('sniper_feed_tokens').delete().lt('updated_at', cutoff);

  return result;
}
