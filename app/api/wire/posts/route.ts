import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * The Wire — native social feed API.
 *
 * POST /api/wire/posts   create a wire (body required; optional media_url,
 *                        repost_of, reply_to). author_id is ALWAYS the authed
 *                        user — never trusted from the client (IDOR-safe).
 * GET  /api/wire/posts   feed, newest first, cursor-paginated by created_at.
 *                        ?cursor=<iso>   older-than pagination
 *                        ?author=<uuid>  a single author's timeline
 *                        ?reposts=<uuid> a user's reposts (from wire_reposts)
 *
 * Counts (like/repost/reply/gift) are trigger-maintained on wire_posts and
 * only ever READ here. Gifts are recorded elsewhere; we never write them.
 */

// Author profile embed — the only FK from wire_posts to profiles.
const AUTHOR = 'author:profiles!wire_posts_author_id_fkey(id,username,display_name,avatar_url,is_verified)';
// Full post select including the embedded original (for reposts) and its author.
const POST_SELECT = `*, ${AUTHOR}, original:wire_posts!wire_posts_repost_of_fkey(*, ${AUTHOR})`;

const PAGE_SIZE = 20;

const CreateBody = z.object({
  body: z.string().trim().min(1, 'Body required').max(600, 'Max 600 characters'),
  media_url: z.string().trim().url().max(2048).optional().nullable(),
  repost_of: z.string().uuid().optional().nullable(),
  reply_to: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const insert = {
    author_id: user.id, // session-derived, never from the client
    body: parsed.data.body,
    media_url: parsed.data.media_url ?? null,
    repost_of: parsed.data.repost_of ?? null,
    reply_to: parsed.data.reply_to ?? null,
  };

  const { data, error } = await sb
    .from('wire_posts')
    .insert(insert)
    .select(POST_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: { ...data, liked: false, reposted: false } });
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const params = req.nextUrl.searchParams;
  const cursor = params.get('cursor');
  const author = params.get('author');
  const reposts = params.get('reposts');

  // Viewer (optional — feed is public-readable). Used only to annotate
  // liked/reposted state, never to widen access.
  const viewer = await getAuthenticatedUser(req);

  // ── A user's reposts timeline (driven off wire_reposts) ─────────────────
  if (reposts) {
    if (!z.string().uuid().safeParse(reposts).success) {
      return NextResponse.json({ error: 'Invalid reposts user id' }, { status: 400 });
    }
    let q = sb
      .from('wire_reposts')
      .select(`created_at, post:wire_posts!wire_reposts_post_id_fkey(${POST_SELECT})`)
      .eq('user_id', reposts)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (cursor) q = q.lt('created_at', cursor);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = Array.isArray(data) ? data : [];
    // Flatten to posts, dropping any whose underlying wire was deleted.
    const posts = rows
      .map((r: any) => (r?.post && !r.post.deleted_at ? { ...r.post, reposted_at: r.created_at } : null))
      .filter(Boolean);
    const annotated = await annotate(sb, posts, viewer?.id);
    const nextCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1]?.created_at ?? null : null;
    return NextResponse.json({ posts: annotated, nextCursor });
  }

  // ── Feed / author timeline ──────────────────────────────────────────────
  let q = sb
    .from('wire_posts')
    .select(POST_SELECT)
    .is('deleted_at', null)
    .is('reply_to', null) // top-level wires + reposts only
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (author) {
    if (!z.string().uuid().safeParse(author).success) {
      return NextResponse.json({ error: 'Invalid author id' }, { status: 400 });
    }
    q = q.eq('author_id', author);
  }
  if (cursor) q = q.lt('created_at', cursor);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = Array.isArray(data) ? data : [];
  const annotated = await annotate(sb, posts, viewer?.id);
  const nextCursor = posts.length === PAGE_SIZE ? posts[posts.length - 1]?.created_at ?? null : null;
  return NextResponse.json({ posts: annotated, nextCursor });
}

/**
 * Attach per-viewer `liked` / `reposted` booleans to a page of posts using a
 * single query per relation. Returns the same posts (with the flags) when no
 * viewer is present the flags are false.
 */
async function annotate(
  sb: ReturnType<typeof getSupabaseAdmin>,
  posts: any[],
  viewerId?: string,
): Promise<any[]> {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  if (!viewerId) return posts.map((p) => ({ ...p, liked: false, reposted: false }));

  const ids = posts.map((p) => p?.id).filter(Boolean);
  if (ids.length === 0) return posts.map((p) => ({ ...p, liked: false, reposted: false }));

  const [{ data: likes }, { data: rps }] = await Promise.all([
    sb.from('wire_post_likes').select('post_id').eq('user_id', viewerId).in('post_id', ids),
    sb.from('wire_reposts').select('post_id').eq('user_id', viewerId).in('post_id', ids),
  ]);

  const likedSet = new Set((likes ?? []).map((r: any) => r.post_id));
  const repostedSet = new Set((rps ?? []).map((r: any) => r.post_id));

  return posts.map((p) => ({
    ...p,
    liked: likedSet.has(p?.id),
    reposted: repostedSet.has(p?.id),
  }));
}
