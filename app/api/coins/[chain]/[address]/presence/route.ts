import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

// A watcher counts as present only while their heartbeat is fresh. Past this
// window their row is ignored, so the count reflects who is really in the room.
const FRESH_MS = 60_000;

/** Distinct users whose heartbeat is within the freshness window. Real presence
 *  only: a stale row is never counted. */
async function watcherCount(
  sb: ReturnType<typeof getSupabaseAdmin>,
  chain: string,
  tokenKey: string,
): Promise<number> {
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const { count } = await sb
    .from('coin_room_presence')
    .select('user_id', { count: 'exact', head: true })
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .gte('last_seen_at', since);
  return count ?? 0;
}

/**
 * GET the current watcher count for a coin room: distinct users with a
 * heartbeat inside the last 60s. Public, no auth. An unresolved coin is an
 * honest 404.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const coin = await resolveCoin(chain, decodeURIComponent(address)).catch(() => null);
  if (!coin) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

  const sb = getSupabaseAdmin();
  const count = await watcherCount(sb, coin.chain, coin.tokenKey);
  return NextResponse.json({ count });
}

/**
 * POST a heartbeat. Auth required. Upserts the caller's last_seen_at for this
 * room through the admin client with an explicit user_id binding, then returns
 * the fresh watcher count so the header can update from a single request.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const coin = await resolveCoin(chain, decodeURIComponent(address)).catch(() => null);
  if (!coin) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('coin_room_presence')
    .upsert(
      {
        chain: coin.chain,
        token_key: coin.tokenKey,
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'chain,token_key,user_id' },
    );
  if (error) return NextResponse.json({ error: 'Could not record presence' }, { status: 500 });

  const count = await watcherCount(sb, coin.chain, coin.tokenKey);
  return NextResponse.json({ count });
}
