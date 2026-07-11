import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { WIRE_TOPIC_SET, WIRE_MAX_TAGS } from '@/lib/wire/topics';
import { computeAuthorSignals } from '@/lib/wire/signal';

/**
 * The Wire - native social feed API.
 *
 * POST /api/wire/posts   create a wire (body required; optional media_url,
 *                        tags[], repost_of, reply_to). author_id is ALWAYS the
 *                        authed user - never trusted from the client (IDOR-safe).
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

// Read + create selects are deliberately EMBED-FREE. PostgREST relationship
// embeds (the profiles author join and the wire_posts self-join for a repost
// original) fail with a hard 500 whenever its schema cache lags a migration,
// which repeatedly blanked the whole Wire ("could not load the wire") and made
// posting look like it failed even though the row was written. Authors and
// repost originals are attached with plain batched queries (fetchAuthors /
// annotate) that a stale relationship cache can never break.
const AUTHOR_COLS = 'id,username,display_name,avatar_url,is_verified';
const POST_SELECT = '*';
const CREATE_SELECT = '*';

/** Batched author-profile fetch, keyed by id. Never fails the caller. */
async function fetchAuthors(
  sb: ReturnType<typeof getSupabaseAdmin>,
  ids: string[],
): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return map;
  const { data } = await sb.from('profiles').select(AUTHOR_COLS).in('id', unique);
  for (const a of data ?? []) map.set(a.id, a);
  return map;
}

const PAGE_SIZE = 20;

// Only accept media that lives in OUR wire-media storage bucket. Rejecting
// arbitrary external URLs stops a wire from smuggling a tracking pixel or an
// off-platform image that loads in every viewer's browser.
const WIRE_MEDIA_MARKER = '/storage/v1/object/public/wire-media/';

// A single bucket-scoped media URL - reused for both the legacy media_url and
// each entry of the media_urls[] array so the storage-origin check is identical.
const WireMediaUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((u) => u.includes(WIRE_MEDIA_MARKER), 'Image must be uploaded to the wire');

const CreateBody = z.object({
  body: z.string().trim().min(1, 'Body required').max(600, 'Max 600 characters'),
  media_url: WireMediaUrl.optional().nullable(),
  media_urls: z
    .array(WireMediaUrl)
    .max(4, 'Up to 4 images')
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

  // Prefer the new media_urls[] (up to 4); fall back to a legacy single
  // media_url so older clients keep working. media_url stays populated with the
  // first image so any reader still on the single column shows something.
  const mediaUrls =
    parsed.data.media_urls && parsed.data.media_urls.length > 0
      ? parsed.data.media_urls
      : parsed.data.media_url
        ? [parsed.data.media_url]
        : [];
  const primaryMediaUrl = mediaUrls[0] ?? null;

  const sb = getSupabaseAdmin();
  const insert = {
    author_id: user.id, // session-derived, never from the client
    body: parsed.data.body,
    media_url: primaryMediaUrl,
    media_urls: mediaUrls,
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
    .select(CREATE_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach the author via a plain query (no embed) so the create response can
  // never fail on a stale relationship cache.
  const authorMap = await fetchAuthors(sb, [user.id]);
  return NextResponse.json({
    post: { ...data, author: authorMap.get(user.id) ?? null, original: null, liked: false, reposted: false },
  });
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const params = req.nextUrl.searchParams;
  const cursor = params.get('cursor');
  const author = params.get('author');
  const reposts = params.get('reposts');
  const feed = params.get('feed'); // 'signal' | 'pack' | null
  const tag = params.get('tag');   // legacy single canonical topic value | null
  const tagsParam = params.get('tags'); // comma-separated canonical topics | null

  if (tag && !WIRE_TOPIC_SET.has(tag)) {
    return NextResponse.json({ error: 'Unknown topic' }, { status: 400 });
  }

  // The Wire settings panel lets a viewer pick several catalogue topics at
  // once. We accept them as a comma list and filter to posts whose tags[]
  // OVERLAP the selection (Postgres `&&`). A single legacy `tag` still works
  // and is folded into the same filter. Unknown values are dropped, never
  // trusted - an all-unknown selection simply means "no topic filter".
  const topicFilter = Array.from(
    new Set(
      [
        ...(tag ? [tag] : []),
        ...(tagsParam ? tagsParam.split(',') : []),
      ]
        .map((t) => t.trim().toLowerCase())
        .filter((t) => WIRE_TOPIC_SET.has(t)),
    ),
  );

  // Viewer (optional - feed is public-readable). Used only to annotate
  // liked/reposted state, never to widen access.
  const viewer = await getAuthenticatedUser(req);

  // Muted authors are hidden from the viewer's feeds (main / signal / pack).
  // We deliberately do NOT filter an explicit ?author= or ?reposts= timeline,
  // so visiting a muted user's profile still works, exactly like X. Empty for
  // signed-out viewers.
  const mutedIds = viewer ? await getMutedIds(sb, viewer.id) : [];
  const mutedList = mutedIds.length ? `(${mutedIds.join(',')})` : null;

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
    if (topicFilter.length) sq = sq.overlaps('tags', topicFilter);
    if (mutedList) sq = sq.not('author_id', 'in', mutedList);

    const { data, error } = await sq;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const candidates = Array.isArray(data) ? data : [];
    const now = Date.now();

    // Real author-signal folded into ranking: compute the transparent 0-100
    // score for every candidate author once, then lift each post's engagement
    // score by a mild factor (1.0 at signal 0, up to 1.5 at signal 100). The
    // same map is reused for annotation so we never query signals twice.
    const signalMap = await computeAuthorSignals(
      sb,
      candidates.map((p: any) => p.author_id).filter(Boolean),
    );

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
        const base = raw / Math.pow(ageHours + 2, 0.5);
        const authorSig = signalMap.get(p.author_id) ?? 0;
        const factor = 1 + (authorSig / 100) * 0.5;
        const score = base * factor;
        return { p, score, ts: new Date(p.created_at).getTime() };
      })
      .sort((a, b) => (b.score - a.score) || (b.ts - a.ts));

    const offset = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
    const page = ranked.slice(offset, offset + PAGE_SIZE).map((r) => r.p);
    const annotated = await annotate(sb, page, viewer?.id, signalMap);
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
    if (topicFilter.length) pq = pq.overlaps('tags', topicFilter);
    if (mutedList) pq = pq.not('author_id', 'in', mutedList);
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

  // ── A user's replies timeline (profile Replies sub-tab) ─────────────────
  const repliesBy = params.get('repliesBy');
  if (repliesBy) {
    if (!z.string().uuid().safeParse(repliesBy).success) {
      return NextResponse.json({ error: 'Invalid replies user id' }, { status: 400 });
    }
    let rq = sb
      .from('wire_posts')
      .select(POST_SELECT)
      .is('deleted_at', null)
      .not('reply_to', 'is', null) // replies only
      .eq('author_id', repliesBy)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (cursor) rq = rq.lt('created_at', cursor);

    const { data, error } = await rq;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const posts = Array.isArray(data) ? data : [];
    const annotated = await annotate(sb, posts, viewer?.id);
    const nextCursor = posts.length === PAGE_SIZE ? posts[posts.length - 1]?.created_at ?? null : null;
    return NextResponse.json({ posts: annotated, nextCursor });
  }

  // ── Feed / author timeline ──────────────────────────────────────────────
  // media=1 (used by the profile Media sub-tab) narrows an author timeline to
  // wires that carry an image. Every media wire keeps media_url populated with
  // its first image, so the null-check is a reliable "has media" filter.
  const mediaOnly = params.get('media') === '1';
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
  if (mediaOnly) q = q.not('media_url', 'is', null);
  if (topicFilter.length) q = q.overlaps('tags', topicFilter);
  // Hide muted authors from the main feed, but not from a single-author timeline.
  if (mutedList && !author) q = q.not('author_id', 'in', mutedList);
  if (cursor) q = q.lt('created_at', cursor);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = Array.isArray(data) ? data : [];
  const annotated = await annotate(sb, posts, viewer?.id);
  const nextCursor = posts.length === PAGE_SIZE ? posts[posts.length - 1]?.created_at ?? null : null;
  return NextResponse.json({ posts: annotated, nextCursor });
}

/** The set of user ids this viewer has muted (hidden from their feeds). */
async function getMutedIds(sb: ReturnType<typeof getSupabaseAdmin>, viewerId: string): Promise<string[]> {
  const { data } = await sb.from('wire_mutes').select('muted_id').eq('muter_id', viewerId);
  return (data ?? []).map((r: { muted_id: string }) => r.muted_id).filter(Boolean);
}

/** Shape a raw wire_predictions row into the WirePost.prediction contract. */
function shapePrediction(raw: any, agreedSet: Set<string>): any {
  if (!raw) return null;
  return {
    id: raw.id,
    symbol: raw.symbol,
    direction: raw.direction,
    target: Number(raw.target),
    priceAtCreate: raw.price_at_create != null ? Number(raw.price_at_create) : null,
    resolvesAt: raw.resolves_at,
    status: raw.status,
    agreeCount: raw.agree_count ?? 0,
    agreed: agreedSet.has(raw.id),
  };
}

/**
 * Attach the per-viewer + SocialFi data contract to a page of wires:
 *   liked / reposted  - viewer engagement (false when signed out)
 *   authorSignal      - the author's transparent 0-100 signal score
 *   prediction        - the inline mini-prediction attached to the wire (if any)
 *
 * A repost embeds its `original`; the same fields are attached there too so the
 * displayed wire (the original) carries its own signal + prediction. One query
 * per relation keeps this O(1) in round-trips. An optional precomputed
 * `signalMap` (from the Signal feed ranking) is reused so signals are not
 * queried twice; any authors it does not already cover are filled in here.
 */
async function annotate(
  sb: ReturnType<typeof getSupabaseAdmin>,
  posts: any[],
  viewerId?: string,
  signalMap?: Map<string, number>,
): Promise<any[]> {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  // Attach repost originals with a plain batched query (embeds removed so a
  // stale relationship cache can never blank the feed). A repost carries
  // repost_of; fetch those originals once and hang them off `.original`.
  const repostOfIds = Array.from(new Set(posts.map((p) => p?.repost_of).filter(Boolean)));
  if (repostOfIds.length) {
    const { data: origs } = await sb.from('wire_posts').select('*').in('id', repostOfIds);
    const origMap = new Map((origs ?? []).map((o: any) => [o.id, o]));
    for (const p of posts) {
      if (p?.repost_of && p.original == null) p.original = origMap.get(p.repost_of) ?? null;
    }
  }

  // Every wire id on the page, including originals of reposts.
  const allIds = Array.from(
    new Set(
      posts
        .flatMap((p) => [p?.id, p?.original?.id])
        .filter(Boolean),
    ),
  );
  if (allIds.length === 0) {
    return posts.map((p) => ({ ...p, liked: false, reposted: false, authorSignal: null, prediction: null }));
  }

  // Author signals (own + original authors), reusing any provided map.
  const authorIds = Array.from(
    new Set(posts.flatMap((p) => [p?.author_id, p?.original?.author_id]).filter(Boolean)),
  );
  const provided = signalMap ?? new Map<string, number>();
  const missing = authorIds.filter((id) => !provided.has(id));
  const extra = missing.length ? await computeAuthorSignals(sb, missing) : new Map<string, number>();
  const signals = new Map<string, number>([...provided, ...extra]);

  // Author profiles for every wire + original on the page (plain query, no embed).
  const authorMap = await fetchAuthors(sb, authorIds);

  // Predictions attached to any wire on the page.
  const { data: preds } = await sb.from('wire_predictions').select('*').in('post_id', allIds);
  const predByPost = new Map<string, any>();
  const predIds: string[] = [];
  for (const pr of preds ?? []) {
    predByPost.set(pr.post_id, pr);
    predIds.push(pr.id);
  }

  // Viewer engagement (liked / reposted / agreed) - only when signed in.
  let likedSet = new Set<string>();
  let repostedSet = new Set<string>();
  let agreedSet = new Set<string>();
  if (viewerId) {
    const [{ data: likes }, { data: rps }, ag] = await Promise.all([
      sb.from('wire_post_likes').select('post_id').eq('user_id', viewerId).in('post_id', allIds),
      sb.from('wire_reposts').select('post_id').eq('user_id', viewerId).in('post_id', allIds),
      predIds.length
        ? sb.from('wire_prediction_agrees').select('prediction_id').eq('user_id', viewerId).in('prediction_id', predIds)
        : Promise.resolve({ data: [] as { prediction_id: string }[] }),
    ]);
    likedSet = new Set((likes ?? []).map((r: any) => r.post_id));
    repostedSet = new Set((rps ?? []).map((r: any) => r.post_id));
    agreedSet = new Set(((ag as any)?.data ?? []).map((r: any) => r.prediction_id));
  }

  const decorate = (p: any) => ({
    ...p,
    author: authorMap.get(p?.author_id) ?? p?.author ?? null,
    liked: likedSet.has(p?.id),
    reposted: repostedSet.has(p?.id),
    authorSignal: signals.has(p?.author_id) ? signals.get(p?.author_id) : null,
    prediction: shapePrediction(predByPost.get(p?.id), agreedSet),
  });

  return posts.map((p) => {
    const out = decorate(p);
    if (out.original) out.original = decorate(out.original);
    return out;
  });
}
