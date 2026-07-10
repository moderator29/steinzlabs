import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type SB = ReturnType<typeof getSupabaseAdmin>;

/**
 * The Wire "signal score" - a transparent 0-100 reputation for an author.
 *
 * Real data only. It is derived from the author's OWN aggregates:
 *   received engagement across every wire they posted
 *     (like_count + 2*repost_count + 3*gift_count + reply_count)
 *   plus their accepted follower count (weighted 3x each).
 *
 * The raw total is mapped through a log10 curve so early traction lifts the
 * score quickly while established accounts never run away with the scale:
 *   raw 0        -> 0
 *   raw ~9       -> 20
 *   raw ~99      -> 40
 *   raw ~999     -> 60
 *   raw ~9,999   -> 80
 *   raw >=99,999 -> 100
 *
 * Nothing here is fabricated: an author with no engagement and no followers
 * scores 0.
 */
export async function computeAuthorSignals(sb: SB, authorIds: string[]): Promise<Map<string, number>> {
  const ids = Array.from(new Set(authorIds.filter(Boolean)));
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const [{ data: posts }, { data: follows }] = await Promise.all([
    sb
      .from('wire_posts')
      .select('author_id, like_count, repost_count, gift_count, reply_count')
      .in('author_id', ids)
      .is('deleted_at', null),
    sb
      .from('social_follows')
      .select('following_id')
      .in('following_id', ids)
      .eq('status', 'accepted'),
  ]);

  const engagement = new Map<string, number>();
  for (const p of posts ?? []) {
    const v =
      (p.like_count ?? 0) +
      2 * (p.repost_count ?? 0) +
      3 * (p.gift_count ?? 0) +
      (p.reply_count ?? 0);
    engagement.set(p.author_id, (engagement.get(p.author_id) ?? 0) + v);
  }

  const followers = new Map<string, number>();
  for (const f of follows ?? []) {
    followers.set(f.following_id, (followers.get(f.following_id) ?? 0) + 1);
  }

  for (const id of ids) {
    const raw = (engagement.get(id) ?? 0) + 3 * (followers.get(id) ?? 0);
    // log10 curve, clamped to [0, 100]. Denominator 5 puts the ceiling at 10^5.
    const score = raw <= 0 ? 0 : Math.min(100, Math.round((Math.log10(raw + 1) / 5) * 100));
    map.set(id, score);
  }

  return map;
}
