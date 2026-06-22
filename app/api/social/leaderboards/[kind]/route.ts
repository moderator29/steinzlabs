import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

/**
 * GET /api/social/leaderboards/[kind]?limit=&offset=
 *
 * One endpoint, eight leaderboards. Each kind has a deterministic
 * SQL ordering that hits an existing index. Caller-blocked users
 * are filtered out post-query so the same response shape works for
 * authed + anon clients.
 *
 * kinds:
 *   success-rate    DESC user_reputation.success_rate
 *   followers       DESC follower_count aggregate
 *   new-users       DESC profiles.created_at
 *   max-tier        WHERE profiles.tier = 'max'
 *   top-traders     DESC portfolio_perf_pct (30d)
 *   copy-traders    DESC copy_trade_winrate
 *   whale-watchers  DESC whale_pick_accuracy
 *   most-active     DESC activity_score
 */

const KIND = z.enum([
  'success-rate',
  'followers',
  'new-users',
  'max-tier',
  'top-traders',
  'copy-traders',
  'whale-watchers',
  'most-active',
]);

type Kind = z.infer<typeof KIND>;

interface LeaderboardRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  verified_badge: string | null;
  is_chosen: boolean | null;
  metric_value: number | string | null;
  metric_label: string;
  // §social-discovery — per-caller follow state so leaderboard rows
  // already show "Following" instead of flipping back to "Follow"
  // when the user navigates between panels. Client-side follow-cache
  // keeps it fresh after follow actions.
  i_follow?: 'not_following' | 'pending' | 'accepted' | null;
  // §social-discovery (whale-watchers) — actual count of whales the
  // user is watching. UI surfaces "Watching N whales" plus a small
  // drill-down button instead of a meaningless percentage.
  following_count?: number | null;
}

const METRIC_LABEL: Record<Kind, string> = {
  'success-rate':   'Success',
  'followers':      'Followers',
  'new-users':      'Joined',
  'max-tier':       'Max Tier',
  'top-traders':    '30d',
  'copy-traders':   'Copy Winrate',
  'whale-watchers': 'Whale Accuracy',
  'most-active':    'Activity',
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await ctx.params;
  const kindParsed = KIND.safeParse(rawKind);
  if (!kindParsed.success) return NextResponse.json({ error: 'Unknown leaderboard kind' }, { status: 400 });
  const kind = kindParsed.data;

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '10')));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? '0'));

  const caller = await getAuthenticatedUser(req);
  const sb = getSupabaseAdmin();

  let rows: LeaderboardRow[] = [];

  if (kind === 'followers') {
    // Aggregate via SQL count on social_follows + join profiles.
    const { data, error } = await sb.rpc('social_top_followers' as never, { p_limit: limit + offset });
    if (error || !data) {
      // RPC not yet created — fall back to a client-side aggregation
      // over the materialized follow edges. Slower but correct.
      const { data: edges } = await sb.from('social_follows').select('following_id').eq('status', 'accepted');
      const counts = new Map<string, number>();
      for (const e of edges ?? []) counts.set(e.following_id, (counts.get(e.following_id) ?? 0) + 1);
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(offset, offset + limit);
      const ids = top.map(([id]) => id);
      const { data: profiles } = await sb
        .from('profiles')
        .select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen')
        .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      const profilesList = (profiles ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; tier: string | null; verified_badge: string | null; is_chosen: boolean | null }>;
      const byId = new Map(profilesList.map((p) => [p.id, p]));
      const built: LeaderboardRow[] = [];
      for (const [id, count] of top) {
        const p = byId.get(id);
        if (!p) continue;
        built.push({
          id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          tier: p.tier,
          verified_badge: p.verified_badge,
          is_chosen: p.is_chosen,
          metric_value: count,
          metric_label: METRIC_LABEL.followers,
        });
      }
      rows = built;
    } else {
      rows = (data as Array<{ id: string; followers: number; username: string | null; display_name: string | null; avatar_url: string | null; tier: string | null; verified_badge: string | null; is_chosen: boolean | null }>)
        .slice(offset, offset + limit)
        .map((r) => ({
          id: r.id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          tier: r.tier,
          verified_badge: r.verified_badge,
          is_chosen: r.is_chosen,
          metric_value: r.followers,
          metric_label: METRIC_LABEL.followers,
        }));
    }
  } else if (kind === 'new-users') {
    const { data } = await sb
      .from('profiles')
      .select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    rows = (data ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      tier: p.tier,
      verified_badge: p.verified_badge,
      is_chosen: p.is_chosen,
      metric_value: p.created_at,
      metric_label: METRIC_LABEL['new-users'],
    }));
  } else if (kind === 'max-tier') {
    // The Max board lists Max-tier platform members. Cult membership is a
    // separate entitlement now (a cult member can be on any tier), so it is
    // no longer conflated with Max here.
    const { data } = await sb
      .from('profiles')
      .select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen, created_at')
      .eq('tier', 'max')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    rows = (data ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      tier: p.tier,
      verified_badge: p.verified_badge,
      is_chosen: p.is_chosen,
      metric_value: 'MAX',
      metric_label: METRIC_LABEL['max-tier'],
    }));
  } else if (kind === 'whale-watchers') {
    // §S1-DATA — was reading user_reputation.whale_pick_accuracy, which is
    // empty until the nightly cron runs. Owners with active whale follows
    // were missing from the board even when user_whale_follows had rows.
    // Aggregate the live follow edges so the board reflects current state.
    const { data: edges } = await sb
      .from('user_whale_follows')
      .select('user_id');
    const counts = new Map<string, number>();
    for (const e of edges ?? []) {
      const uid = (e as { user_id: string | null }).user_id;
      if (uid) counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(offset, offset + limit);
    const ids = top.map(([id]) => id);
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen')
      .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    type ProfileLite = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; tier: string | null; verified_badge: string | null; is_chosen: boolean | null };
    const byId = new Map(((profiles ?? []) as ProfileLite[]).map((p) => [p.id, p]));
    rows = top.flatMap(([id, count]) => {
      const p = byId.get(id);
      if (!p) return [];
      return [{
        id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        tier: p.tier,
        verified_badge: p.verified_badge,
        is_chosen: p.is_chosen,
        // metric_value carries the whale count for the UI's primary
        // line; following_count duplicates it for the "Show whales"
        // drill-down (clearer field name + future-proof if we add
        // accuracy back as the metric).
        metric_value: count,
        following_count: count,
        metric_label: METRIC_LABEL['whale-watchers'],
      }];
    });
  } else {
    // Reputation-backed leaderboards
    const orderCol: Record<Exclude<Kind, 'followers' | 'new-users' | 'max-tier' | 'whale-watchers'>, string> = {
      'success-rate':   'success_rate',
      'top-traders':    'portfolio_perf_pct',
      'copy-traders':   'copy_trade_winrate',
      'most-active':    'activity_score',
    };
    const col = orderCol[kind as Exclude<Kind, 'followers' | 'new-users' | 'max-tier' | 'whale-watchers'>];
    // Dynamic select string defeats Supabase's typed inference; cast
    // through unknown to the shape we actually return.
    const repRes = await sb
      .from('user_reputation')
      .select(`user_id, ${col}`)
      .not(col, 'is', null)
      .order(col, { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    const repRows = ((repRes.data ?? []) as unknown) as Array<Record<string, unknown>>;
    const ids = repRows.map((r) => String(r.user_id));
    const profilesRes = await sb
      .from('profiles')
      .select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen, show_success_rate')
      .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    type ProfileLite = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; tier: string | null; verified_badge: string | null; is_chosen: boolean | null; show_success_rate: boolean | null };
    const profileList = (profilesRes.data ?? []) as ProfileLite[];
    const byId = new Map(profileList.map((p) => [p.id, p]));
    const built: LeaderboardRow[] = [];
    for (const r of repRows) {
      const userId = String(r.user_id);
      const p = byId.get(userId);
      if (!p) continue;
      if (kind === 'success-rate' && !p.show_success_rate) continue;
      const metricRaw = r[col];
      const metric = typeof metricRaw === 'number' ? metricRaw : metricRaw == null ? null : Number(metricRaw);
      built.push({
        id: userId,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        tier: p.tier,
        verified_badge: p.verified_badge,
        is_chosen: p.is_chosen,
        metric_value: metric,
        metric_label: METRIC_LABEL[kind],
      });
    }
    rows = built;
  }

  // Hide caller's blocked users
  if (caller && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: blocks } = await sb
      .from('social_blocks')
      .select('blocked_id, blocker_id')
      .or(`and(blocker_id.eq.${caller.id},blocked_id.in.(${ids.join(',')})),and(blocked_id.eq.${caller.id},blocker_id.in.(${ids.join(',')}))`);
    const hidden = new Set((blocks ?? []).map((b) => (b.blocker_id === caller.id ? b.blocked_id : b.blocker_id)));
    rows = rows.filter((r) => !hidden.has(r.id));
  }

  // §social-discovery — enrich rows with caller's follow state so the
  // UI's FollowButton renders the correct initial label across all
  // leaderboard panels. Without this every panel renders "Follow"
  // until the user touches the button.
  if (caller && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: follows } = await sb
      .from('social_follows')
      .select('following_id, status')
      .eq('follower_id', caller.id)
      .in('following_id', ids);
    const byId = new Map(
      (follows ?? []).map((f) => [
        (f as { following_id: string }).following_id,
        ((f as { status: string }).status === 'pending' ? 'pending' : 'accepted') as 'pending' | 'accepted',
      ]),
    );
    rows = rows.map((r) => ({ ...r, i_follow: byId.get(r.id) ?? 'not_following' }));
  }

  // §social-discovery — drop rows with a null username. Clicking those
  // rows was landing the user on /u/null (Bug 6: "user not found"
  // when clicking some real users). Old accounts that never set a
  // username can re-appear once they pick one.
  rows = rows.filter((r) => r.username !== null && r.username !== '');

  return NextResponse.json({ kind, rows, refreshed_at: new Date().toISOString() });
}
