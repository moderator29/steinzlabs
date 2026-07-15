import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface ProfileLite {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface TapeTradeRow {
  user_id: string;
  chain: string;
  token_key: string;
  token_address: string | null;
  symbol: string | null;
  side: 'buy' | 'sell';
  usd_amount: number | string;
  market_cap_usd: number | string | null;
  created_at: string;
}

interface RegistryLite {
  chain: string;
  token_key: string;
  symbol: string | null;
  logo_url: string | null;
}

/**
 * The living floor tape: recent buys and sells across the platform, newest
 * first, joined to the trader's profile and the coin registry for a real logo
 * and symbol. `?scope=following` (auth required) narrows the feed to trades by
 * people the caller follows. Honest empty array when there is nothing real.
 */
export async function GET(req: NextRequest) {
  const scope = new URL(req.url).searchParams.get('scope');
  const sb = getSupabaseAdmin();

  let followingIds: string[] | null = null;
  if (scope === 'following') {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ trades: [] });
    const { data: follows } = await sb
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted');
    followingIds = [...new Set(((follows as Array<{ following_id: string }>) ?? []).map((f) => f.following_id))];
    if (followingIds.length === 0) return NextResponse.json({ trades: [] });
  }

  let query = sb
    .from('coin_trades')
    .select('user_id, chain, token_key, token_address, symbol, side, usd_amount, market_cap_usd, created_at')
    .order('created_at', { ascending: false })
    .limit(40);
  if (followingIds) query = query.in('user_id', followingIds);

  const { data } = await query;
  const rows = (data as TapeTradeRow[]) ?? [];
  if (rows.length === 0) return NextResponse.json({ trades: [] });

  // Profiles for the traders.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profiles = new Map<string, ProfileLite>();
  {
    const { data: pdata } = await sb
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);
    for (const p of (pdata as ProfileLite[]) ?? []) profiles.set(p.id, p);
  }

  // Registry for real logo + symbol, keyed by chain:token_key.
  const tokenKeys = [...new Set(rows.map((r) => r.token_key))];
  const registry = new Map<string, RegistryLite>();
  if (tokenKeys.length) {
    const { data: reg } = await sb
      .from('coin_registry')
      .select('chain, token_key, symbol, logo_url')
      .in('token_key', tokenKeys);
    for (const r of (reg as RegistryLite[]) ?? []) registry.set(`${r.chain}:${r.token_key}`, r);
  }

  const trades = rows
    .map((r) => {
      const user = profiles.get(r.user_id);
      if (!user) return null;
      const meta = registry.get(`${r.chain}:${r.token_key}`);
      return {
        user,
        side: r.side,
        usdAmount: Number(r.usd_amount) || 0,
        marketCapUsd: r.market_cap_usd != null ? Number(r.market_cap_usd) : null,
        symbol: r.symbol ?? meta?.symbol ?? null,
        logoUrl: meta?.logo_url ?? null,
        chain: r.chain,
        tokenAddress: r.token_address,
        timestamp: Date.parse(r.created_at),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return NextResponse.json({ trades });
}
