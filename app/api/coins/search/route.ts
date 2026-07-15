import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { universalSearch } from '@/lib/search/universalSearch';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isCoinChain } from '@/lib/coins/types';
import { tokenKeyFor } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

const MIN_LIQ = 1_000;

/**
 * Unified "search for anything": coins (graduated on SOL/ETH/BNB DEXs) plus
 * people (Naka profiles) in one payload. Real data only.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ coins: [], people: [] });

  const [coins, people] = await Promise.all([searchCoins(q), searchPeople(q)]);
  return NextResponse.json({ coins, people });
}

async function searchCoins(q: string) {
  try {
    const results = await universalSearch(q);
    return results
      .filter((r) => isCoinChain(r.chain))
      .filter((r) => (r.liquidityUSD ?? r.liquidity ?? 0) >= MIN_LIQ || (r.marketCap ?? 0) > 0)
      .slice(0, 20)
      .map((r) => ({
        chain: r.chain,
        tokenAddress: r.address,
        tokenKey: tokenKeyFor(r.chain, r.address),
        symbol: r.symbol,
        name: r.name,
        logoUrl: r.logo ?? null,
        priceUsd: r.priceUSD ?? r.price ?? null,
        marketCapUsd: r.marketCap ?? null,
        change24h: r.priceChange24h ?? null,
        verified: !!r.verified,
      }));
  } catch {
    return [];
  }
}

async function searchPeople(q: string) {
  try {
    const sb = getSupabaseAdmin();
    // Strip PostgREST filter metacharacters so the .or() grammar cannot break
    // or be reinterpreted, then wrap the pattern in quotes.
    const safe = q.replace(/[%_,()".*\\]/g, '').trim();
    if (!safe) return [];
    const like = `"%${safe}%"`;
    const { data } = await sb
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_verified, verified_badge')
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .limit(12);
    return ((data as Array<Record<string, unknown>>) ?? []).map((p) => ({
      id: p.id,
      username: p.username ?? null,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      verified: !!p.is_verified,
      verified_badge: p.verified_badge ?? null,
    }));
  } catch {
    return [];
  }
}
