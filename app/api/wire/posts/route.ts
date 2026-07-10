import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { WIRE_TOPIC_SET, WIRE_MAX_TAGS } from '@/lib/wire/topics';

/**
 * The Wire — native social feed API.
 *
 * POST /api/wire/posts   create a wire (body required; optional media_url,
 *                        tags[], repost_of, reply_to). author_id is ALWAYS the
 *                        authed user — never trusted from the client (IDOR-safe).
 * GET  /api/wire/posts   feeds & timelines.
 *                        ?feed=signal   trending: real engagement score over the
 *                                       last 48h with mild time decay; paginated
 *                                       by numeric offset cursor.
 *                        ?feed=pack     posts by users the viewer follows
 *                                       (social_follows, status=accepted).
 *                        ?tag=<topic>   filter to posts whose tags contain the
 *                                       canonical topic (GIN-indexed contains).
 *                        ?cursor=<iso|n> older-than pagination (offset for signal)
 *                        ?author=<uuid> a single author's timeline
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

// Only accept media that lives in OUR wire-media storage bucket. Rejecting
// arbitrary external URLs stops a wire from smuggling a tracking pixel or an
// off-platform image that loads in every viewer's browser.
const WIRE_MEDIA_MARKER = '/storage/v1/object/public/wire-media/';

const CreateBody = z.object({
  body: z.string().trim().min(1, 'Body required').max(600, 'Max 600 characters'),
  media_url: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((u) => u.includes(WIRE_MEDIA_MARKER), 'Image must be uploaded to the wire')
    .optional()
    .nullable(),
  repost_of: z.string().uuid().optional().nullable(),
  tags: z
    .array(z.string())
    .max(WIRE_MAX_TAGS, `Up to ${WIRE_MAX_TAGS} topics`)
    .optional()
    .nullable(),
});

/** Canonicalise + validate a client-supplied tag list (dedupe, drop unknowns). */
function cleanTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const raw of tags) {
    const v = String(raw).trim().toLowerCase();
    if (WIRE_TOPIC_SET.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= WIRE_MAX_TAGS) break;
  }
  return out;
}

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
    // Replies are created ONLY through /api/wire/posts/[id]/reply, which enforces
    // the single-level "cannot reply to a reply" rule. Never honor a client
    // reply_to here or that guard can be bypassed.
    reply_to: null,
    tags: cleanTags(parsed.data.tags),
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
  const feed = params.get('feed'); // 'signal' | 'pack' | null
  const tag = params.get('tag');   // canonical topic value | null

  if (tag && !WIRE_TOPIC_SET.has(tag)) {
    return NextResponse.json({ error: 'Unknown topic' }, { status: 400 });
  }

  // Viewer (optional — feed is public-readable). Used only to annotate
  // liked/reposted state, never to widen access.
  const viewer = await getAuthenticatedUser(req);

  // ── Signal: trending by real engagement over the last 48h ───────────────
  if (feed === 'signal') {
    const WINDOW_HOURS = 48;
    const CANDIDATE_CAP = 300;
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();

    let sq = sb
      .from('wire_posts')
      .select(POST_SELECT)
      .is('deleted_at', null)
      .is('reply_to', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_CAP);
    if (tag) sq = sq.contains('tags', [tag]);

    const { data, error } = await sq;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const candidates = Array.isArray(data) ? data : [];
    const now = Date.now();
    const ranked = candidates
      .map((p: any) => {
        const raw =
          (p.like_count ?? 0) +
          2 * (p.repost_count ?? 0) +
          3 * (p.gift_count ?? 0) +
          (p.reply_count ?? 0);
        const ageHours = Math.max(0, (now - new Date(p.created_at).getTime()) / 3_600_000);
        // Mild time decay (gravity 0.5): keeps fresh, engaged posts on top
        // without ever fabricating a boost. Zero-engagement posts fall back to
        // created_at ordering via the tie-break below.
        const score = raw / Math.pow(ageHours + 2, 0.5);
        return { p, score, ts: new Date(p.created_at).getTime() };
      })
      .sort((a, b) => (b.score - a.score) || (b.ts - a.ts));

    const offset = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
    const page = ranked.slice(offset, offset + PAGE_SIZE).map((r) => r.p);
    const annotated = await annotate(sb, page, viewer?.id);
    const nextCursor = ranked.length > offset + PAGE_SIZE ? String(offset + PAGE_SIZE) : null;
    return NextResponse.json({ posts: annotated, nextCursor });
  }

  // ── Pack: posts authored by users the viewer follows ────────────────────
  if (feed === 'pack') {
    if (!viewer) return NextResponse.json({ posts: [], nextCursor: null, reason: 'signed_out' });

    const { data: edges, error: edgeErr } = await sb
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', viewer.id)
      .eq('status', 'accepted');
    if (edgeErr) return NextResponse.json({ error: edgeErr.message }, { status: 500 });

    const followingIds = Array.from(
      new Set((edges ?? []).map((e: any) => e.following_id).filter(Boolean)),
    );
    if (followingIds.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null, reason: 'no_follows' });
    }

    let pq = sb
      .from('wire_posts')
      .select(POST_SELECT)
      .is('deleted_at', null)
      .is('reply_to', null)
      .in('author_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (tag) pq = pq.contains('tags', [tag]);
    if (cursor) pq = pq.lt('created_at', cursor);

    const { data, error } = await pq;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const posts = Array.isArray(data) ? data : [];
    const annotated = await annotate(sb, posts, viewer?.id);
    const nextCursor = posts.length === PAGE_SIZE ? posts[posts.length - 1]?.created_at ?? null : null;
    return NextResponse.json({ posts: annotated, nextCursor });
  }

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
  if (tag) q = q.contains('tags', [tag]);
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
