import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Range = '7d' | '30d' | 'all';

function parseRange(v: string | null): Range {
  return v === '7d' || v === '30d' ? v : 'all';
}

function windowDays(range: Range): number | null {
  if (range === 'all') return null;
  return range === '7d' ? 7 : 30;
}

/** UTC day key YYYY-MM-DD for a timestamp. */
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Inclusive list of the last N UTC day keys ending today. */
function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(today.getTime() - i * 86400_000));
  return out;
}

/**
 * Real account/social analytics for the caller: follower growth, likes/replies/
 * reposts received on their Wire posts, top posts and profile views. Range
 * (7d/30d/all) scopes the time-series and the in-range deltas; headline totals
 * are lifetime.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get('range'));
  const win = windowDays(range);
  const cutoffMs = win == null ? null : Date.parse(`${lastNDays(win)[0]}T00:00:00.000Z`);
  const sb = getSupabaseAdmin();

  // ── Follows ──────────────────────────────────────────────────────────────
  const [{ data: followerRows }, { count: followingCount }] = await Promise.all([
    sb.from('social_follows').select('created_at').eq('following_id', user.id).eq('status', 'accepted'),
    sb.from('social_follows').select('follower_id', { count: 'exact', head: true }).eq('follower_id', user.id).eq('status', 'accepted'),
  ]);
  const followerTimes = ((followerRows as Array<{ created_at: string }>) ?? [])
    .map((r) => Date.parse(r.created_at))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const followersTotal = followerTimes.length;
  const netNewFollowers = cutoffMs == null ? followersTotal : followerTimes.filter((t) => t >= cutoffMs).length;

  // Cumulative followers series across the window (baseline before the window).
  let followersSeries: Array<{ day: string; total: number }> = [];
  if (win != null) {
    const days = lastNDays(win);
    const start = Date.parse(`${days[0]}T00:00:00.000Z`);
    let running = followerTimes.filter((t) => t < start).length;
    const addByDay = new Map<string, number>();
    for (const t of followerTimes) if (t >= start) addByDay.set(dayKey(t), (addByDay.get(dayKey(t)) ?? 0) + 1);
    followersSeries = days.map((day) => { running += addByDay.get(day) ?? 0; return { day, total: running }; });
  } else if (followerTimes.length > 0) {
    const addByDay = new Map<string, number>();
    for (const t of followerTimes) addByDay.set(dayKey(t), (addByDay.get(dayKey(t)) ?? 0) + 1);
    const sorted = [...addByDay.keys()].sort();
    let running = 0;
    followersSeries = sorted.slice(-366).map((day) => { running += addByDay.get(day) ?? 0; return { day, total: running }; });
  }

  // ── Posts + engagement (lifetime) ────────────────────────────────────────
  const { data: postRows } = await sb
    .from('wire_posts')
    .select('id, body, like_count, reply_count, repost_count, created_at')
    .eq('author_id', user.id)
    .is('deleted_at', null)
    .order('like_count', { ascending: false })
    .limit(1000);
  const posts = (postRows as Array<{ id: string; body: string | null; like_count: number | null; reply_count: number | null; repost_count: number | null; created_at: string }>) ?? [];
  const postsCount = posts.length;
  const totalLikesReceived = posts.reduce((s, p) => s + (p.like_count ?? 0), 0);
  const repliesReceived = posts.reduce((s, p) => s + (p.reply_count ?? 0), 0);
  const reposts = posts.reduce((s, p) => s + (p.repost_count ?? 0), 0);
  const engagementRate = postsCount > 0 ? ((totalLikesReceived + repliesReceived + reposts) / postsCount) : null;

  const topPosts = [...posts]
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      snippet: (p.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
      likes: p.like_count ?? 0,
      replies: p.reply_count ?? 0,
      reposts: p.repost_count ?? 0,
      createdAt: p.created_at,
    }));

  // ── Likes received over time (join wire_post_likes to my posts) ──────────
  const myPostIds = posts.map((p) => p.id);
  let likesSeries: Array<{ day: string; count: number }> = [];
  if (myPostIds.length > 0) {
    let likeQuery = sb.from('wire_post_likes').select('created_at').in('post_id', myPostIds);
    if (cutoffMs != null) likeQuery = likeQuery.gte('created_at', new Date(cutoffMs).toISOString());
    const { data: likeRows } = await likeQuery.limit(20000);
    const likeTimes = ((likeRows as Array<{ created_at: string }>) ?? []).map((r) => Date.parse(r.created_at)).filter(Number.isFinite);
    const byDay = new Map<string, number>();
    for (const t of likeTimes) byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + 1);
    if (win != null) {
      likesSeries = lastNDays(win).map((day) => ({ day, count: byDay.get(day) ?? 0 }));
    } else {
      likesSeries = [...byDay.keys()].sort().slice(-366).map((day) => ({ day, count: byDay.get(day) ?? 0 }));
    }
  }

  // ── Profile views ─────────────────────────────────────────────────────────
  let viewQuery = sb.from('profile_view_daily').select('day, views').eq('profile_id', user.id).order('day', { ascending: true });
  if (win != null) viewQuery = viewQuery.gte('day', lastNDays(win)[0]);
  const { data: viewRows } = await viewQuery.limit(1000);
  const viewByDay = new Map<string, number>();
  for (const r of (viewRows as Array<{ day: string; views: number | null }>) ?? []) viewByDay.set(r.day, (viewByDay.get(r.day) ?? 0) + (r.views ?? 0));
  const profileViews = [...viewByDay.values()].reduce((s, v) => s + v, 0);
  let viewsSeries: Array<{ day: string; views: number }> = [];
  if (win != null) {
    viewsSeries = lastNDays(win).map((day) => ({ day, views: viewByDay.get(day) ?? 0 }));
  } else {
    viewsSeries = [...viewByDay.keys()].sort().slice(-366).map((day) => ({ day, views: viewByDay.get(day) ?? 0 }));
  }

  return NextResponse.json({
    range,
    followersTotal,
    followingTotal: followingCount ?? 0,
    followersSeries,
    netNewFollowers,
    postsCount,
    totalLikesReceived,
    likesSeries,
    repliesReceived,
    reposts,
    engagementRate,
    topPosts,
    profileViews,
    viewsSeries,
  });
}
