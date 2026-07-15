import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getDiscovery, type DiscoveryTab } from '@/lib/coins/coinService';
import { getWatchlistKeys } from '@/lib/coins/social';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isCoinChain } from '@/lib/coins/types';

export const dynamic = 'force-dynamic';

const VALID_TABS = new Set<DiscoveryTab>(['trending', 'graduated', 'most_held']);

/**
 * Coins discovery for the Coins area. Query: ?tab=trending|graduated|most_held|watchlist
 * &chain=solana|ethereum|bsc (omit chain for all). Real data only, keyless.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tabParam = url.searchParams.get('tab') || 'trending';
  const chainParam = url.searchParams.get('chain') || undefined;
  const chain = chainParam && isCoinChain(chainParam) ? chainParam : undefined;

  // Watchlist tab is per-user and read from our own registry snapshot.
  if (tabParam === 'watchlist') {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ coins: [] });
    const keys = await getWatchlistKeys(user.id);
    if (keys.size === 0) return NextResponse.json({ coins: [] });
    const sb = getSupabaseAdmin();
    const tokenKeys = [...keys].map((k) => k.split(':')[1]);
    const { data } = await sb
      .from('coin_registry')
      .select('*')
      .in('token_key', tokenKeys)
      .eq('hidden', false)
      .order('market_cap_usd', { ascending: false, nullsFirst: false });
    const coins = ((data as Array<Record<string, unknown>>) ?? [])
      .filter((r) => keys.has(`${r.chain}:${r.token_key}`))
      .filter((r) => !chain || r.chain === chain)
      .map(registryRowToApiCoin);
    return NextResponse.json({ coins });
  }

  const tab: DiscoveryTab = VALID_TABS.has(tabParam as DiscoveryTab) ? (tabParam as DiscoveryTab) : 'trending';
  const coins = await getDiscovery(tab, chain);
  return NextResponse.json({ coins });
}

function registryRowToApiCoin(r: Record<string, unknown>) {
  const s = (r.socials ?? {}) as Record<string, string | null>;
  return {
    chain: r.chain,
    tokenAddress: r.token_address,
    tokenKey: r.token_key,
    symbol: r.symbol ?? '',
    name: r.name ?? r.symbol ?? '',
    logoUrl: r.logo_url ?? null,
    decimals: r.decimals ?? null,
    priceUsd: r.price_usd ?? null,
    marketCapUsd: r.market_cap_usd ?? null,
    fdvUsd: r.market_cap_usd ?? null,
    liquidityUsd: r.liquidity_usd ?? null,
    volume24hUsd: r.volume_24h_usd ?? null,
    change5m: null,
    change1h: r.change_1h ?? null,
    change24h: r.change_24h ?? null,
    txns24h: null,
    pairAddress: r.pair_address ?? null,
    dex: r.dex ?? null,
    socials: { website: s.website ?? null, twitter: s.twitter ?? null, telegram: s.telegram ?? null },
    verified: !!r.verified,
    featured: !!r.featured,
    isGraduated: !!r.is_graduated,
    holdersCount: r.holders_count ?? null,
    pairCreatedAt: null,
  };
}
