import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Social permission gating. Server-side only — every API route that
 * touches DM or follow state should hit canUserDM / isBlocked first.
 *
 * Uses the admin client because we routinely need to read the
 * receiver's settings even when the sender wouldn't normally have
 * SELECT on them (e.g., dm_permission). RLS on writes still enforces
 * sender-side correctness.
 */

export type DmDecision =
  | { allowed: true }
  | { allowed: false; reason: 'blocked' | 'self' | 'nobody' | 'not-following' | 'not-mutual' | 'suspended' };

export async function canUserDM(senderId: string, receiverId: string): Promise<DmDecision> {
  if (senderId === receiverId) return { allowed: false, reason: 'self' };
  const sb = getSupabaseAdmin();

  const { data: blocked } = await sb
    .from('social_blocks')
    .select('id')
    .or(`and(blocker_id.eq.${receiverId},blocked_id.eq.${senderId}),and(blocker_id.eq.${senderId},blocked_id.eq.${receiverId})`)
    .limit(1);
  if (blocked && blocked.length > 0) return { allowed: false, reason: 'blocked' };

  const { data: receiver } = await sb
    .from('profiles')
    .select('dm_permission, social_suspended_until')
    .eq('id', receiverId)
    .maybeSingle();
  if (!receiver) return { allowed: false, reason: 'nobody' };
  if (receiver.social_suspended_until && new Date(receiver.social_suspended_until) > new Date()) {
    return { allowed: false, reason: 'suspended' };
  }

  // Open-DM model (X / Instagram style): anyone can message anyone unless the
  // recipient has EXPLICITLY restricted DMs, or there's a block. Users who
  // never set a preference (null/unset) default to OPEN. Explicit 'mutual' /
  // 'following' / 'nobody' choices are still honored.
  switch (receiver.dm_permission) {
    case 'nobody':
      return { allowed: false, reason: 'nobody' };
    case 'following': {
      const { data: rel } = await sb
        .from('social_follows')
        .select('id')
        .eq('follower_id', receiverId)
        .eq('following_id', senderId)
        .eq('status', 'accepted')
        .maybeSingle();
      return rel ? { allowed: true } : { allowed: false, reason: 'not-following' };
    }
    case 'mutual': {
      const [aToB, bToA] = await Promise.all([
        sb.from('social_follows').select('id').eq('follower_id', senderId).eq('following_id', receiverId).eq('status', 'accepted').maybeSingle(),
        sb.from('social_follows').select('id').eq('follower_id', receiverId).eq('following_id', senderId).eq('status', 'accepted').maybeSingle(),
      ]);
      return aToB.data && bToA.data ? { allowed: true } : { allowed: false, reason: 'not-mutual' };
    }
    case 'everyone':
    default:
      return { allowed: true };
  }
}

export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('social_blocks')
    .select('id')
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  return !!(data && data.length);
}

/** Canonicalize a DM pair into (user_a, user_b) with user_a < user_b. */
export function canonicalizePair(x: string, y: string): { user_a_id: string; user_b_id: string } {
  return x < y ? { user_a_id: x, user_b_id: y } : { user_a_id: y, user_b_id: x };
}
