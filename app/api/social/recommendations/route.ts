import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/social/recommendations
 *
 * Returns up to 10 "you might like to follow" candidates per visit.
 * Composite scoring:
 *   +3  followed by people you follow (collaborative filtering)
 *   +2  tier above caller's tier (aspirational follows)
 *   +2  high success_rate (>= 75)
 *   +1  recently active (created_at within 30d AND not already followed)
 *
 * Excludes: self, already-following, already-blocked (either direction),
 * already-dismissed via X-Dismissed-Recommendations header (client-side
 * 'not interested' state — server is stateless so the client sends the
 * dismiss set on each request). Backlog: persist dismissals server-side
 * in a social_recommendations_dismissed table once the UI demands it.
 */

// Platform tiers only. NakaCult is a separate entitlement (NIPPO NFT -> cult
// features), NOT a platform tier — a cult member keeps their own Free/Mini/Pro/Max.
const TIER_RANK: Record<string, number> = { free: 0, mini: 1, pro: 2, max: 3 };

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ users: [] });
  const sb = getSupabaseAdmin();

  const dismissedHeader = req.headers.get('x-dismissed-recommendations') ?? '';
  const dismissed = new Set(dismissedHeader.split(',').map((s) => s.trim()).filter(Boolean));

  // 1. Who I follow
  const { data: outgoing } = await sb
    .from('social_follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted');
  const myFollows = new Set((outgoing ?? []).map((r) => r.following_id));

  // 2. Who *they* follow (collab filtering) — bounded by following set size
  const collabCounts = new Map<string, number>();
  if (myFollows.size > 0) {
    const { data: secondHop } = await sb
      .from('social_follows')
      .select('follower_id, following_id')
      .in('follower_id', Array.from(myFollows))
      .eq('status', 'accepted')
      .limit(500);
    for (const e of secondHop ?? []) {
      if (e.following_id === user.id) continue;
      if (myFollows.has(e.following_id)) continue;
      collabCounts.set(e.following_id, (collabCounts.get(e.following_id) ?? 0) + 1);
    }
  }

  // 3. My tier (for "tier above" boost)
  const { data: myProfile } = await sb.from('profiles').select('tier').eq('id', user.id).maybeSingle();
  const myTierRank = TIER_RANK[myProfile?.tier ?? 'free'] ?? 0;

  // 4. Blocked set (both directions)
  const { data: blocks } = await sb
    .from('social_blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
  const blocked = new Set((blocks ?? []).map((b) => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id)));

  // Muted set (one-directional — hide users the caller muted).
  const { data: mutes } = await sb
    .from('social_mutes')
    .select('muted_id')
    .eq('muter_id', user.id);
  const muted = new Set((mutes ?? []).map((m) => m.muted_id));

  // 4b. Top-followed users — bias recommendations toward ESTABLISHED accounts
  // (most followers on the platform) rather than brand-new signups. Aggregate
  // accepted follow edges and rank by follower count.
  const { data: followEdges } = await sb
    .from('social_follows')
    .select('following_id')
    .eq('status', 'accepted')
    .limit(5000);
  const followerCounts = new Map<string, number>();
  for (const e of followEdges ?? []) {
    followerCounts.set(e.following_id, (followerCounts.get(e.following_id) ?? 0) + 1);
  }
  const topFollowed = Array.from(followerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([id]) => id);

  // 5. Candidate pool: top-followed + high-success-rate + recently-active users
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  type ProfileLite = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; tier: string | null; verified_badge: string | null; is_chosen: boolean | null };

  const collabIds = Array.from(collabCounts.keys()).slice(0, 30);
  const [highRepRes, recentRes, collabRes] = await Promise.all([
    sb.from('user_reputation').select('user_id, success_rate').gte('success_rate', 75).order('success_rate', { ascending: false }).limit(40),
    sb.from('profiles').select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen, created_at').gte('created_at', thirtyDaysAgo).limit(40),
    collabIds.length > 0
      ? sb.from('profiles').select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen').in('id', collabIds)
      : Promise.resolve({ data: [] as ProfileLite[] }),
  ]);
  const highRep = (highRepRes.data ?? []) as Array<{ user_id: string; success_rate: number }>;
  const recent = (recentRes.data ?? []) as Array<ProfileLite & { created_at: string }>;
  const collabProfiles = (collabRes.data ?? []) as ProfileLite[];

  const repMap = new Map(highRep.map((r) => [r.user_id, r.success_rate]));
  const candidateIds = new Set<string>([
    ...topFollowed,
    ...Array.from(repMap.keys()),
    ...recent.map((p) => p.id),
    ...collabProfiles.map((p) => p.id),
  ]);
  candidateIds.delete(user.id);
  for (const id of myFollows) candidateIds.delete(id);
  for (const id of blocked) candidateIds.delete(id);
  for (const id of muted) candidateIds.delete(id);
  for (const id of dismissed) candidateIds.delete(id);

  if (candidateIds.size === 0) return NextResponse.json({ users: [] });

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen, created_at, show_success_rate')
    .in('id', Array.from(candidateIds));

  const scored = (profiles ?? []).map((p) => {
    let score = 0;
    let reason = '';
    // Top followers rank highest — established accounts, not brand-new ones.
    const fc = followerCounts.get(p.id) ?? 0;
    if (fc > 0) {
      score += 4 + Math.min(4, Math.floor(fc / 5));
      reason = `${fc.toLocaleString()} follower${fc === 1 ? '' : 's'}`;
    }
    if (collabCounts.has(p.id)) {
      score += 3 + Math.min(2, collabCounts.get(p.id)! - 1);
      reason = 'Followed by people you follow';
    }
    const peerRank = TIER_RANK[p.tier ?? 'free'] ?? 0;
    if (peerRank > myTierRank) { score += 2; if (!reason) reason = `${p.tier?.toUpperCase()} tier`; }
    const rep = repMap.get(p.id);
    if (typeof rep === 'number' && rep >= 75) { score += 2; if (!reason) reason = `${rep}/100 success rate`; }
    if (p.created_at && p.created_at >= thirtyDaysAgo) { score += 1; if (!reason) reason = 'New on platform'; }
    return {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      tier: p.tier,
      verified_badge: p.verified_badge,
      is_chosen: p.is_chosen,
      success_rate: p.show_success_rate ? (rep ?? null) : null,
      reason: reason || 'Active trader',
      score,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return NextResponse.json({ users: scored.slice(0, 10) });
}
