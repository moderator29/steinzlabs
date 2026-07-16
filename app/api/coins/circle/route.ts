import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface BuyRow {
  user_id: string;
  chain: string;
  token_key: string;
  token_address: string | null;
  symbol: string | null;
}

interface RegistryRow {
  chain: string;
  token_key: string;
  symbol: string | null;
  logo_url: string | null;
  price_usd: number | string | null;
  market_cap_usd: number | string | null;
  change_24h: number | string | null;
}

/**
 * Coins that people the caller follows bought in the last 24h, deduped per coin
 * and ranked by how many distinct followed traders bought it. Joined to the
 * registry for a real logo, price, market cap and 24h change. Empty array when
 * the caller follows no one or none of them bought anything.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ coins: [] });

  const sb = getSupabaseAdmin();
  const { data: follows } = await sb
    .from('social_follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted');
  const followingIds = [...new Set(((follows as Array<{ following_id: string }>) ?? []).map((f) => f.following_id))];
  if (followingIds.length === 0) return NextResponse.json({ coins: [] });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from('coin_trades')
    .select('user_id, chain, token_key, token_address, symbol')
    .eq('side', 'buy')
    .in('user_id', followingIds)
    .gte('created_at', since)
    .limit(5000);
  const rows = (data as BuyRow[]) ?? [];
  if (rows.length === 0) return NextResponse.json({ coins: [] });

  // Dedupe per coin, counting distinct followed buyers.
  interface Agg { chain: string; tokenKey: string; tokenAddress: string | null; symbol: string | null; buyers: Set<string> }
  const byCoin = new Map<string, Agg>();
  for (const r of rows) {
    const key = `${r.chain}:${r.token_key}`;
    const a = byCoin.get(key) ?? { chain: r.chain, tokenKey: r.token_key, tokenAddress: r.token_address, symbol: r.symbol, buyers: new Set<string>() };
    a.buyers.add(r.user_id);
    if (r.symbol) a.symbol = r.symbol;
    if (!a.tokenAddress && r.token_address) a.tokenAddress = r.token_address;
    byCoin.set(key, a);
  }

  const aggs = [...byCoin.values()];
  const tokenKeys = [...new Set(aggs.map((a) => a.tokenKey))];
  const registry = new Map<string, RegistryRow>();
  if (tokenKeys.length) {
    const { data: reg } = await sb
      .from('coin_registry')
      .select('chain, token_key, symbol, logo_url, price_usd, market_cap_usd, change_24h')
      .in('token_key', tokenKeys);
    for (const r of (reg as RegistryRow[]) ?? []) registry.set(`${r.chain}:${r.token_key}`, r);
  }

  const coins = aggs
    .map((a) => {
      const meta = registry.get(`${a.chain}:${a.tokenKey}`);
      return {
        chain: a.chain,
        tokenAddress: a.tokenAddress,
        tokenKey: a.tokenKey,
        symbol: a.symbol ?? meta?.symbol ?? null,
        logoUrl: meta?.logo_url ?? null,
        priceUsd: meta?.price_usd != null ? Number(meta.price_usd) : null,
        marketCapUsd: meta?.market_cap_usd != null ? Number(meta.market_cap_usd) : null,
        change24h: meta?.change_24h != null ? Number(meta.change_24h) : null,
        buyerCount: a.buyers.size,
      };
    })
    .sort((x, y) => y.buyerCount - x.buyerCount);

  return NextResponse.json({ coins });
}
