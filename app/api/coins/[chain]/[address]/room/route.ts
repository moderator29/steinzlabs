import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

const MAX_BODY = 500;
const PAGE = 60;

interface RoomAuthor {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
}

/** Batch-load author profiles for a set of user ids (no PostgREST embed). */
async function loadAuthors(
  sb: ReturnType<typeof getSupabaseAdmin>,
  ids: string[],
): Promise<Map<string, RoomAuthor>> {
  const map = new Map<string, RoomAuthor>();
  if (!ids.length) return map;
  const { data } = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url, tier')
    .in('id', ids);
  for (const p of (data as RoomAuthor[]) ?? []) map.set(p.id, p);
  return map;
}

/**
 * GET the coin's room: the latest 60 messages, returned oldest-first so the
 * chat renders top-to-bottom. Authors are joined by a plain batched profiles
 * query. Real data only; an unresolved coin is an honest 404.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const coin = await resolveCoin(chain, decodeURIComponent(address)).catch(() => null);
  if (!coin) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_room_messages')
    .select('id, body, user_id, created_at')
    .eq('chain', coin.chain)
    .eq('token_key', coin.tokenKey)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE);

  const rows = ((data as Array<{ id: string; body: string; user_id: string; created_at: string }>) ?? []).reverse();
  const authors = await loadAuthors(sb, [...new Set(rows.map((r) => r.user_id))]);
  const messages = rows.map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    author: authors.get(r.user_id) ?? null,
  }));
  return NextResponse.json({ symbol: coin.symbol, messages });
}

/**
 * POST a message to the coin's room. Auth required. Inserts with an explicit
 * user_id binding through the admin client; body is trimmed and must be 1..500
 * chars. Returns the created message with its author.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const coin = await resolveCoin(chain, decodeURIComponent(address)).catch(() => null);
  if (!coin) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  const text = (body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  if (text.length > MAX_BODY) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('coin_room_messages')
    .insert({
      chain: coin.chain,
      token_key: coin.tokenKey,
      token_address: coin.tokenAddress,
      symbol: coin.symbol,
      user_id: user.id,
      body: text,
    })
    .select('id, body, user_id, created_at')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Could not post message' }, { status: 500 });

  const row = data as { id: string; body: string; user_id: string; created_at: string };
  const authors = await loadAuthors(sb, [row.user_id]);
  return NextResponse.json({
    message: {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      author: authors.get(row.user_id) ?? null,
    },
  });
}
