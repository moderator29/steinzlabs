import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

const MAX = 500;

/**
 * The coin's slice of The Wire: real wire posts that reference this coin's
 * ticker (by $TICKER in the body or the ticker in the post tags). Same posts
 * that live in the main Wire, filtered to this coin. Real data only.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const coin = await resolveCoin(chain, decodeURIComponent(address)).catch(() => null);
  const symbol = coin?.symbol?.trim();
  // Only alphanumeric tickers are safe to interpolate into the filter.
  const safe = symbol ? symbol.replace(/[^a-zA-Z0-9]/g, '') : '';
  if (!safe) return NextResponse.json({ posts: [], symbol: symbol ?? null });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('wire_posts')
    .select('id, author_id, body, media_urls, like_count, reply_count, repost_count, created_at')
    .is('deleted_at', null)
    .or(`body.ilike.%$${safe}%,tags.cs.{${safe}}`)
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = (data as Array<Record<string, unknown>>) ?? [];
  const ids = [...new Set(rows.map((r) => r.author_id as string))];
  const profiles = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, username, display_name, avatar_url, tier, is_verified').in('id', ids);
    for (const p of (profs as Array<Record<string, unknown>>) ?? []) profiles.set(p.id as string, p);
  }
  const posts = rows.map((r) => ({
    id: r.id, body: r.body, media_urls: r.media_urls ?? [], like_count: r.like_count ?? 0,
    reply_count: r.reply_count ?? 0, repost_count: r.repost_count ?? 0, created_at: r.created_at,
    author: profiles.get(r.author_id as string) ?? null,
  }));
  return NextResponse.json({ posts, symbol });
}

/** Post to the coin's Wire. Creates a real wire post that carries the ticker. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const coin = await resolveCoin(chain, decodeURIComponent(address)).catch(() => null);
  const symbol = coin?.symbol?.trim();
  const safe = symbol ? symbol.replace(/[^a-zA-Z0-9]/g, '') : '';
  if (!safe) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  let text = (body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Empty post' }, { status: 400 });
  if (text.length > MAX) return NextResponse.json({ error: 'Post too long' }, { status: 400 });
  // Guarantee the ticker is present so it lands in this coin's Wire.
  if (!new RegExp(`\\$${safe}\\b`, 'i').test(text)) text = `${text} $${safe}`;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('wire_posts')
    .insert({ author_id: user.id, body: text, tags: [safe], audience: 'everyone' })
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not post' }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string })?.id });
}
