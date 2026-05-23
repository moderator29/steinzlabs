import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isBlockedBetween } from '@/lib/social/permissions';

/**
 * GET /api/social/profile/[username]
 *
 * Returns the public social profile for a user: bio + tier + success
 * rate + counts + my-relationship-to-them. Visibility flags on the
 * target profile gate which fields come back (show_success_rate,
 * show_activity, show_wallet_balance). Blocked users return 404.
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const caller = await getAuthenticatedUser(req);
  const sb = getSupabaseAdmin();

  // §social-discovery (Bug 6) — was `.eq('username', username)` which
  // is case-sensitive. Leaderboard rows carry whatever casing the DB
  // stored at signup ("Seyifunmi"), but clicks from elsewhere on the
  // platform sometimes lowercase the segment, producing "user not
  // found" 404s for users that clearly exist. ilike with no wildcards
  // is case-insensitive exact match, hits the same btree index.
  //
  // /u/Puffnutz fix: leaderboard rows fall back to `r.id` (UUID) when
  // username is null. If the slug looks like a UUID, look up by id too.
  const cols = 'id, username, display_name, avatar_url, bio, tier, verified_badge, is_verified, is_chosen, is_private, dm_permission, show_success_rate, show_wallet_balance, show_activity, social_links, social_suspended_until, created_at';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const initial = await sb.from('profiles').select(cols).ilike('username', username).maybeSingle();
  let profile = initial.data;
  if (!profile && UUID_RE.test(username)) {
    const byId = await sb.from('profiles').select(cols).eq('id', username).maybeSingle();
    profile = byId.data;
  }
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (caller && (await isBlockedBetween(caller.id, profile.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ count: followers }, { count: following }] = await Promise.all([
    sb.from('social_follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.id).eq('status', 'accepted'),
    sb.from('social_follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id).eq('status', 'accepted'),
  ]);

  let successRate: number | null = null;
  if (profile.show_success_rate) {
    const { data: rep } = await sb.from('user_reputation').select('success_rate').eq('user_id', profile.id).maybeSingle();
    successRate = rep?.success_rate ?? null;
  }

  let myRelationship: {
    i_follow: boolean;
    they_follow_me: boolean;
    pending_outgoing: boolean;
    pending_incoming: boolean;
    i_blocked: boolean;
    i_muted: boolean;
  } | null = null;
  if (caller && caller.id !== profile.id) {
    const [out, inb, blocked, muted] = await Promise.all([
      sb.from('social_follows').select('status').eq('follower_id', caller.id).eq('following_id', profile.id).maybeSingle(),
      sb.from('social_follows').select('status').eq('follower_id', profile.id).eq('following_id', caller.id).maybeSingle(),
      sb.from('social_blocks').select('id').eq('blocker_id', caller.id).eq('blocked_id', profile.id).maybeSingle(),
      sb.from('social_mutes').select('id').eq('muter_id', caller.id).eq('muted_id', profile.id).maybeSingle(),
    ]);
    myRelationship = {
      i_follow: out.data?.status === 'accepted',
      they_follow_me: inb.data?.status === 'accepted',
      pending_outgoing: out.data?.status === 'pending',
      pending_incoming: inb.data?.status === 'pending',
      i_blocked: !!blocked.data,
      i_muted: !!muted.data,
    };
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      tier: profile.tier,
      verified_badge: profile.verified_badge,
      is_verified: profile.is_verified,
      is_chosen: profile.is_chosen,
      is_private: profile.is_private,
      dm_permission: profile.dm_permission,
      show_activity: profile.show_activity,
      social_links: profile.social_links,
      created_at: profile.created_at,
    },
    counts: { followers: followers ?? 0, following: following ?? 0 },
    success_rate: successRate,
    relationship: myRelationship,
  });
}
