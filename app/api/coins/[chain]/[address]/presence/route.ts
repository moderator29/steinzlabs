import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { tokenKeyFor } from '@/lib/coins/coinService';
import { isCoinChain } from '@/lib/coins/types';

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
  const decoded = decodeURIComponent(address);
  // Presence is a hot, public, repeated heartbeat: derive the key cheaply
  // instead of a full resolveCoin (which hits external DEX APIs + upserts).
  if (!isCoinChain(chain) || !decoded) return NextResponse.json({ count: 0 });
  const tokenKey = tokenKeyFor(chain, decoded);

  const sb = getSupabaseAdmin();
  const count = await watcherCount(sb, chain, tokenKey);
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

  const decoded = decodeURIComponent(address);
  if (!isCoinChain(chain) || !decoded) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const tokenKey = tokenKeyFor(chain, decoded);

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('coin_room_presence')
    .upsert(
      {
        chain,
        token_key: tokenKey,
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'chain,token_key,user_id' },
    );
  if (error) return NextResponse.json({ error: 'Could not record presence' }, { status: 500 });

  const count = await watcherCount(sb, chain, tokenKey);
  return NextResponse.json({ count });
}
