import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/social/users/[id]
 *
 * Per-user social activity dump for the admin moderation view.
 * Includes counts (followers/following/blocks/mutes/dms/reports
 * filed/reports against) + suspicious-activity flags computed on
 * the fly.
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId = await verifyAdminRequest(req);
  if (!adminId) return unauthorizedResponse();
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();

  const [profile, followers, following, blocksMade, blocksAgainst, mutesAgainst, reportsFiled, reportsAgainst, dmsSent, recentFollows] = await Promise.all([
    sb.from('profiles').select('id, username, display_name, avatar_url, tier, role, social_suspended_until, created_at').eq('id', id).maybeSingle(),
    sb.from('social_follows').select('id', { count: 'exact', head: true }).eq('following_id', id).eq('status', 'accepted'),
    sb.from('social_follows').select('id', { count: 'exact', head: true }).eq('follower_id', id).eq('status', 'accepted'),
    sb.from('social_blocks').select('id', { count: 'exact', head: true }).eq('blocker_id', id),
    sb.from('social_blocks').select('id', { count: 'exact', head: true }).eq('blocked_id', id),
    sb.from('social_mutes').select('id', { count: 'exact', head: true }).eq('muted_id', id),
    sb.from('user_reports').select('id', { count: 'exact', head: true }).eq('reporter_id', id),
    sb.from('user_reports').select('id', { count: 'exact', head: true }).eq('reported_id', id),
    sb.from('dm_messages').select('id', { count: 'exact', head: true }).eq('sender_id', id),
    sb.from('social_follows').select('created_at').eq('follower_id', id).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const followsLast24h = (recentFollows.data ?? []).length;
  const flags: string[] = [];
  if (followsLast24h > 50) flags.push(`High follow velocity: ${followsLast24h} in last 24h`);
  if ((blocksAgainst.count ?? 0) > 10) flags.push(`Blocked by ${blocksAgainst.count} users`);
  if ((reportsAgainst.count ?? 0) > 3) flags.push(`${reportsAgainst.count} reports filed against`);
  if ((reportsFiled.count ?? 0) > 20) flags.push(`${reportsFiled.count} reports filed (possible abuse)`);

  return NextResponse.json({
    profile: profile.data ?? null,
    counts: {
      followers: followers.count ?? 0,
      following: following.count ?? 0,
      blocks_made: blocksMade.count ?? 0,
      blocks_against: blocksAgainst.count ?? 0,
      mutes_against: mutesAgainst.count ?? 0,
      reports_filed: reportsFiled.count ?? 0,
      reports_against: reportsAgainst.count ?? 0,
      dms_sent: dmsSent.count ?? 0,
      follows_last_24h: followsLast24h,
    },
    suspicious_flags: flags,
  });
}
