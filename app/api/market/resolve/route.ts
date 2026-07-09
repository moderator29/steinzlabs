import 'server-only';
import { NextResponse } from 'next/server';
import {
  searchTokens as cgSearchTokens,
  getMarketsByIds,
  getContractPrice,
} from '@/lib/services/coingecko';
import {
  searchPairs,
  getTokenPairs,
  type DexPair,
} from '@/lib/services/dexscreener';
import {
  searchTokens as gtSearchTokens,
  getTokenMeta,
} from '@/lib/services/geckoterminal';
import { getDextoolsToken, dextoolsEnabled } from '@/lib/services/dextools';
import { resolveTokenChain } from '@/lib/market/tokenChainResolver';
import { isEvmContract, isSolanaAddress } from '@/lib/market/tokenIdMaps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Universal market search / resolve.
 *
 * Widened from a CoinGecko-only lookup to cover ANY coin that exists on
 * DexScreener or DexTools (10k+), searchable by name, symbol, or contract:
 *
 *   Contract (0x… / base58) → DexScreener token pairs (per-chain, real
 *     price/liquidity/volume/mcap/logo), then DexTools (only if a key is
 *     configured — pure enhancement), then GeckoTerminal token metadata
 *     (keyless, real name/symbol/logo/price for both Solana and EVM), then
 *     CoinGecko contract-price as the price-only last resort. Every path
 *     returns real data with no DexTools key present.
 *
 *   Name / symbol → CoinGecko /search (majors, enriched with real market
 *     data for price + mcap + ranking) MERGED with DexScreener /search and
 *     GeckoTerminal /search/pools (the long-tail). Results are deduped by
 *     identity and ranked by mcap → liquidity → volume so the coin the user
 *     means surfaces first.
 *
 * Every number is real (fetched from a live source). Nothing is fabricated;
 * a source that returns nothing simply contributes no matches.
 */

interface ResolvedMatch {
  id: string | null;          // CoinGecko id when known (routes to rich page)
  name: string;
  symbol: string;
  image: string | null;
  chain: string;
  address: string | null;     // contract when kind=contract or dex-sourced
  priceUsd: number;
  liquidityUsd?: number | null;
  volume24h?: number | null;
  marketCap?: number | null;
  change24h?: number | null;
  source: 'coingecko' | 'dexscreener' | 'geckoterminal' | 'dextools';
}

const EVM_PLATFORMS = ['ethereum', 'bsc', 'polygon', 'base', 'arbitrum', 'optimism', 'avalanche'];

// Rank score — mcap when known, else liquidity, else volume. Both are USD
// magnitudes so a $1B major outranks a $2M long-tail pool naturally.
function scoreOf(m: ResolvedMatch): number {
  return m.marketCap || m.liquidityUsd || m.volume24h || 0;
}

function dedupeKey(m: ResolvedMatch): string {
  return m.id ? `cg:${m.id}` : `${m.chain}:${(m.address ?? '').toLowerCase()}`;
}

function bestPairPerToken(pairs: DexPair[]): Map<string, DexPair> {
  const byToken = new Map<string, DexPair>();
  for (const p of pairs) {
    const key = `${p.chainId?.toLowerCase()}:${p.baseToken.address?.toLowerCase()}`;
    const existing = byToken.get(key);
    if (!existing || (p.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      byToken.set(key, p);
    }
  }
  return byToken;
}

function matchFromPair(p: DexPair): ResolvedMatch {
  return {
    id: null,
    name: p.baseToken.name,
    symbol: (p.baseToken.symbol || '').toUpperCase(),
    image: p.info?.imageUrl ?? null,
    chain: p.chainId,
    address: p.baseToken.address,
    priceUsd: p.priceUsd ? parseFloat(p.priceUsd) || 0 : 0,
    liquidityUsd: p.liquidity?.usd ?? null,
    volume24h: p.volume?.h24 ?? null,
    marketCap: p.marketCap ?? p.fdv ?? null,
    change24h: p.priceChange?.h24 ?? null,
    source: 'dexscreener',
  };
}

// ─── Contract resolution ──────────────────────────────────────────────────
async function resolveContract(q: string): Promise<ResolvedMatch[]> {
  const matches: ResolvedMatch[] = [];

  // 1. DexScreener — one call returns every pair for the contract across chains.
  try {
    const pairs = await getTokenPairs(q);
    for (const p of bestPairPerToken(pairs).values()) matches.push(matchFromPair(p));
  } catch { /* fall through */ }

  if (matches.length > 0) return matches.sort((a, b) => scoreOf(b) - scoreOf(a));

  // 2. DexTools (only if a key is configured) — probe supported chains.
  if (dextoolsEnabled() && isEvmContract(q)) {
    const probes = await Promise.all(
      EVM_PLATFORMS.map((chain) => getDextoolsToken(chain, q).catch(() => null)),
    );
    for (const t of probes) {
      if (t && (t.priceUsd ?? 0) > 0) {
        matches.push({
          id: null, name: t.name, symbol: t.symbol, image: t.logo,
          chain: t.chain, address: t.address, priceUsd: t.priceUsd ?? 0,
          marketCap: t.marketCap, source: 'dextools',
        });
      }
    }
  }

  // 3a. GeckoTerminal token metadata (keyless, 100+ networks) for Solana.
  if (matches.length === 0 && isSolanaAddress(q)) {
    const meta = await getTokenMeta('solana', q).catch(() => null);
    if (meta && (meta.priceUsd ?? 0) > 0) {
      matches.push({
        id: null, name: meta.name, symbol: meta.symbol, image: meta.logo,
        chain: 'solana', address: q, priceUsd: meta.priceUsd ?? 0, source: 'geckoterminal',
      });
    }
  }

  // 3b. GeckoTerminal token metadata for EVM contracts — the keyless equivalent
  //     of the DexTools probe above. When DexScreener misses a contract and no
  //     DexTools key is configured, this still resolves REAL name/symbol/logo/
  //     price across the EVM platforms, so the result is a full token identity
  //     rather than the price-only CoinGecko fallback below. (mcap has no free
  //     source in this single-call path, so it stays null honestly.)
  if (matches.length === 0 && isEvmContract(q)) {
    const probes = await Promise.all(
      EVM_PLATFORMS.map((chain) => getTokenMeta(chain, q).catch(() => null)),
    );
    for (const meta of probes) {
      if (meta && (meta.priceUsd ?? 0) > 0) {
        matches.push({
          id: null, name: meta.name, symbol: meta.symbol, image: meta.logo,
          chain: meta.chain, address: q, priceUsd: meta.priceUsd ?? 0, source: 'geckoterminal',
        });
      }
    }
  }

  // 4. CoinGecko contract price across EVM platforms — last-resort price signal.
  if (matches.length === 0 && isEvmContract(q)) {
    await Promise.all(EVM_PLATFORMS.map(async (chain) => {
      try {
        const price = await getContractPrice(q, chain);
        if (price > 0) {
          matches.push({
            id: null, name: `${chain.toUpperCase()} token`, symbol: `${q.slice(0, 6)}…`,
            image: null, chain, address: q, priceUsd: price, source: 'coingecko',
          });
        }
      } catch { /* chain miss */ }
    }));
  }

  return matches.sort((a, b) => scoreOf(b) - scoreOf(a));
}

// ─── Name / symbol resolution ─────────────────────────────────────────────
async function resolveText(q: string): Promise<ResolvedMatch[]> {
  const [cgRes, dexRes, gtRes] = await Promise.allSettled([
    cgSearchTokens(q),
    searchPairs(q),
    gtSearchTokens(q),
  ]);

  const out: ResolvedMatch[] = [];

  // CoinGecko — enrich the top hits with real market data so majors carry a
  // price + mcap and rank correctly. /search returns ids ordered by relevance;
  // one /coins/markets call hydrates them.
  if (cgRes.status === 'fulfilled') {
    const coins = (cgRes.value.coins ?? []).slice(0, 10);
    const ids = coins.map((c) => c.id);
    let markets: Awaited<ReturnType<typeof getMarketsByIds>> = [];
    try { markets = await getMarketsByIds(ids, false); } catch { /* keep unpriced */ }
    const mById = new Map(markets.map((m) => [m.id, m]));
    for (const c of coins) {
      const m = mById.get(c.id);
      out.push({
        id: c.id,
        name: c.name,
        symbol: (c.symbol || '').toUpperCase(),
        image: m?.image ?? c.thumb ?? null,
        chain: resolveTokenChain({ id: c.id, symbol: c.symbol }).chain,
        address: null,
        priceUsd: m?.current_price ?? 0,
        marketCap: m?.market_cap ?? null,
        volume24h: m?.total_volume ?? null,
        change24h: m?.price_change_percentage_24h ?? null,
        source: 'coingecko',
      });
    }
  }

  // DexScreener — the 10k+ long-tail. Best pair per token, real numbers.
  if (dexRes.status === 'fulfilled') {
    for (const p of bestPairPerToken(dexRes.value).values()) out.push(matchFromPair(p));
  }

  // GeckoTerminal — extra long-tail coverage (keyless, 100+ networks).
  if (gtRes.status === 'fulfilled') {
    for (const h of gtRes.value.slice(0, 15)) {
      out.push({
        id: null, name: h.name, symbol: h.symbol, image: null,
        chain: h.chain, address: h.address, priceUsd: 0,
        liquidityUsd: h.liquidityUsd || null, source: 'geckoterminal',
      });
    }
  }

  // Dedupe by identity, preferring a CoinGecko entry (richer detail page) when
  // the same token arrives from multiple sources.
  const byKey = new Map<string, ResolvedMatch>();
  for (const m of out) {
    const key = dedupeKey(m);
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, m); continue; }
    // Prefer the entry that carries a price / more signal.
    if (scoreOf(m) > scoreOf(existing) || (m.priceUsd > 0 && existing.priceUsd === 0)) {
      byKey.set(key, m);
    }
  }

  const ql = q.toLowerCase();
  return [...byKey.values()].sort((a, b) => {
    // Exact symbol match bubbles to the top.
    const aExact = a.symbol.toLowerCase() === ql ? 1 : 0;
    const bExact = b.symbol.toLowerCase() === ql ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return scoreOf(b) - scoreOf(a);
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ kind: 'ticker', matches: [] });

  try {
    if (isEvmContract(q) || isSolanaAddress(q)) {
      const matches = await resolveContract(q);
      return NextResponse.json({ kind: 'contract', matches: matches.slice(0, 30) }, {
        headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
      });
    }

    const matches = await resolveText(q);
    return NextResponse.json({ kind: 'ticker', matches: matches.slice(0, 30) }, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
    });
  } catch (err) {
    console.error('[market/resolve]', err);
    return NextResponse.json({ kind: 'ticker', matches: [] }, { status: 502 });
  }
}
