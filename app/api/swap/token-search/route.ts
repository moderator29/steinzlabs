import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { searchTokens as gtSearchTokens } from '@/lib/services/geckoterminal';
import { twGatewayConfigured, twSearchAssets } from '@/lib/services/trustwallet';

// Universal token search for the swap token selector. The selector's local
// list only covers ~26 curated symbols; this endpoint lets users find ANY
// token by name/symbol (Trust-Wallet-style) via DexScreener's keyless search
// API, mapped back to the swap page's chain ids. Address pastes stay on the
// existing /api/swap/token-meta path.
//
// Provider: GET https://api.dexscreener.com/latest/dex/search?q=<query>
// (free, no key, all major EVM chains + Solana). Results are deduped by
// (chain, base token address) keeping the highest-liquidity pair so the list
// is real tradeable tokens, not one row per pool.

const DS_CHAIN_TO_SWAP: Record<string, string> = {
  ethereum: 'ethereum',
  base: 'base',
  solana: 'solana',
  bsc: 'bsc',
  polygon: 'polygon',
  avalanche: 'avalanche',
  arbitrum: 'arbitrum',
};

interface DsPair {
  chainId?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceUsd?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  info?: { imageUrl?: string };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const chainFilter = (searchParams.get('chain') || '').toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ tokens: [] });
  }
  try {
    // Two keyless indexers in parallel — DexScreener (rich metadata + logos)
    // and GeckoTerminal (widest network coverage). Between them virtually any
    // DEX-traded token resolves; anything still missing imports via CA paste
    // (token-meta's Alchemy/GT/on-chain path).
    const [dsRes, gtHits] = await Promise.all([
      fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 60 } }).catch(() => null),
      gtSearchTokens(q, chainFilter || undefined).catch(() => []),
    ]);
    const data = (dsRes && dsRes.ok ? await dsRes.json() : { pairs: [] }) as { pairs?: DsPair[] };
    if ((!data.pairs || data.pairs.length === 0) && gtHits.length === 0 && (!dsRes || !dsRes.ok)) {
      return NextResponse.json({ tokens: [], error: 'search_upstream_unavailable' }, { status: 502 });
    }
    const best = new Map<string, { chain: string; address: string; symbol: string; name: string; logo: string | null; liquidityUsd: number; volume24hUsd: number; priceUsd: number | null }>();
    for (const p of data.pairs ?? []) {
      const chain = DS_CHAIN_TO_SWAP[(p.chainId || '').toLowerCase()];
      const addr = p.baseToken?.address;
      const symbol = p.baseToken?.symbol;
      if (!chain || !addr || !symbol) continue;
      if (chainFilter && chain !== chainFilter) continue;
      const key = `${chain}:${addr.toLowerCase()}`;
      const liq = p.liquidity?.usd ?? 0;
      const existing = best.get(key);
      if (existing && existing.liquidityUsd >= liq) continue;
      best.set(key, {
        chain,
        address: addr,
        symbol,
        name: p.baseToken?.name || symbol,
        logo: p.info?.imageUrl ?? null,
        liquidityUsd: liq,
        volume24hUsd: p.volume?.h24 ?? 0,
        priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
      });
    }
    // Fold in GeckoTerminal hits DexScreener missed (keeps DS metadata when
    // both indexers know the token — DS rows carry logos and volume).
    for (const g of gtHits) {
      if (!DS_CHAIN_TO_SWAP[g.chain] && !Object.values(DS_CHAIN_TO_SWAP).includes(g.chain)) continue;
      const key = `${g.chain}:${g.address.toLowerCase()}`;
      if (best.has(key)) continue;
      best.set(key, {
        chain: g.chain,
        address: g.address,
        symbol: g.symbol,
        name: g.name,
        logo: null,
        liquidityUsd: g.liquidityUsd,
        volume24hUsd: 0,
        priceUsd: null,
      });
    }
    const tokens = Array.from(best.values())
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
      .slice(0, 20);

    // Trust Wallet identity enrichment (env-gated, one call per search): tag
    // rows whose contract Trust Wallet's registry verifies, so the UI can show
    // a real "Verified" mark. Matched by address (scam clones share a symbol,
    // never a contract), so a namesake can't inherit the badge. Degrades to
    // unverified rows when TW isn't configured — never blocks the response.
    let verified: Array<typeof tokens[number] & { verified: boolean }> = tokens.map((t) => ({ ...t, verified: false }));
    if (twGatewayConfigured() && tokens.length > 0) {
      try {
        const twHits = await twSearchAssets(q);
        const verifiedAddrs = new Set(
          twHits.filter((h) => h.verified && h.address).map((h) => h.address!.toLowerCase()),
        );
        if (verifiedAddrs.size > 0) {
          verified = tokens.map((t) => ({ ...t, verified: verifiedAddrs.has(t.address.toLowerCase()) }));
        }
      } catch { /* TW down/rate-limited — rows stay unverified, non-fatal */ }
    }

    return NextResponse.json(
      { tokens: verified },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json({ tokens: [], error: 'search_failed' }, { status: 502 });
  }
}
