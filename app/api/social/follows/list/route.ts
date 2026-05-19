import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/social/follows/list?user_id=&kind=followers|following&q=&sort=&limit=&cursor=
 *
 * Paginated list of someone's followers or following. Each row is
 * enriched with the target profile basics + my-relationship so the
 * X-style list UI renders Follow-Back / Following / DM correctly
 * in one render pass.
 *
 * Hides users blocked by the caller. Pagination is cursor-based
 * (created_at descending) so infinite-scroll is consistent under
 * concurrent writes.
 */

const Schema = z.object({
  user_id: z.string().uuid(),
  kind: z.enum(['followers', 'following']),
  q: z.string().max(64).optional(),
  sort: z.enum(['recent', 'success', 'followers_count']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  const sp = req.nextUrl.searchParams;
  const parsed = Schema.safeParse({
    user_id: sp.get('user_id'),
    kind: sp.get('kind'),
    q: sp.get('q') ?? undefined,
    sort: sp.get('sort') ?? undefined,
    limit: sp.get('limit') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { user_id, kind, q, sort, limit, cursor } = parsed.data;

  const sb = getSupabaseAdmin();
  const peerCol = kind === 'followers' ? 'follower_id' : 'following_id';
  const ownerCol = kind === 'followers' ? 'following_id' : 'follower_id';

  let query = sb
    .from('social_follows')
    .select(`id, created_at, ${peerCol}`)
    .eq(ownerCol, user_id)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) query = query.lt('created_at', cursor);

  const { data: edges, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const peerIds = (edges ?? []).map((e) => (e as Record<string, string>)[peerCol]);
  if (peerIds.length === 0) return NextResponse.json({ users: [], next_cursor: null });

  // Hide users blocked by caller
  let blockedSet = new Set<string>();
  if (caller) {
    const { data: blocks } = await sb
      .from('social_blocks')
      .select('blocked_id, blocker_id')
      .or(`and(blocker_id.eq.${caller.id},blocked_id.in.(${peerIds.join(',')})),and(blocked_id.eq.${caller.id},blocker_id.in.(${peerIds.join(',')}))`);
    blockedSet = new Set((blocks ?? []).map((b) => (b.blocker_id === caller.id ? b.blocked_id : b.blocker_id)));
  }
  const visibleIds = peerIds.filter((id) => !blockedSet.has(id));

  const [{ data: profiles }, { data: reps }, { data: myRel }] = await Promise.all([
    sb.from('profiles').select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen, show_success_rate').in('id', visibleIds),
    sb.from('user_reputation').select('user_id, success_rate').in('user_id', visibleIds),
    caller ? sb.from('social_follows').select('following_id, status').eq('follower_id', caller.id).in('following_id', visibleIds) : Promise.resolve({ data: [] as Array<{ following_id: string; status: string }> }),
  ]);
  const repMap = new Map((reps ?? []).map((r) => [r.user_id, r.success_rate]));
  const relMap = new Map((myRel ?? []).map((r) => [r.following_id, r.status]));

  let users = (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    tier: p.tier,
    verified_badge: p.verified_badge,
    is_chosen: p.is_chosen,
    success_rate: p.show_success_rate ? (repMap.get(p.id) ?? null) : null,
    i_follow: relMap.get(p.id) === 'accepted',
    pending_outgoing: relMap.get(p.id) === 'pending',
  }));

  if (q) {
    const needle = q.toLowerCase();
    users = users.filter((u) =>
      u.username?.toLowerCase().includes(needle) || u.display_name?.toLowerCase().includes(needle),
    );
  }
  if (sort === 'success') users.sort((a, b) => (b.success_rate ?? -1) - (a.success_rate ?? -1));

  const nextCursor = edges && edges.length === limit ? edges[edges.length - 1].created_at : null;
  return NextResponse.json({ users, next_cursor: nextCursor });
}
