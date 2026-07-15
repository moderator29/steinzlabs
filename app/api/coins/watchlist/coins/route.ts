import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getWatchlistKeys } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

interface RegistryRow {
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  name: string | null;
  logo_url: string | null;
  price_usd: number | string | null;
  market_cap_usd: number | string | null;
  change_24h: number | string | null;
}

interface WatchlistCoin {
  chain: string;
  tokenAddress: string;
  tokenKey: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
}

const CAP = 30;

/**
 * The caller's watchlisted coins with full registry rows to render, so the home
 * mini-tape can paint logos, prices, and 24h deltas without a second lookup.
 * Empty array when the watchlist is empty or the user is signed out.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ coins: [] });

  const keys = await getWatchlistKeys(user.id);
  if (keys.size === 0) return NextResponse.json({ coins: [] });

  const tokenKeys = [...new Set([...keys].map((k) => k.slice(k.indexOf(':') + 1)))];
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_registry')
    .select('chain, token_key, token_address, symbol, name, logo_url, price_usd, market_cap_usd, change_24h')
    .in('token_key', tokenKeys);

  const num = (v: number | string | null): number | null =>
    v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);

  const coins: WatchlistCoin[] = ((data as RegistryRow[]) ?? [])
    // A token_key can repeat across chains, so match the exact chain:token_key
    // pairs the user actually watchlisted rather than every registry hit.
    .filter((r) => keys.has(`${r.chain}:${r.token_key}`))
    .map((r) => ({
      chain: r.chain,
      tokenAddress: r.token_address,
      tokenKey: r.token_key,
      symbol: r.symbol ?? '',
      name: r.name ?? '',
      logoUrl: r.logo_url ?? null,
      priceUsd: num(r.price_usd),
      marketCapUsd: num(r.market_cap_usd),
      change24h: num(r.change_24h),
    }))
    // Biggest recent movers first, then alphabetical by symbol for a stable tail.
    .sort((a, b) => {
      const am = Math.abs(a.change24h ?? -Infinity);
      const bm = Math.abs(b.change24h ?? -Infinity);
      if (bm !== am) return bm - am;
      return a.symbol.localeCompare(b.symbol);
    })
    .slice(0, CAP);

  return NextResponse.json({ coins });
}
