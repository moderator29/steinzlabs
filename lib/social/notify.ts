import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Social event notification dispatcher. Audit Agent 6 found
 * social_notification_preferences was migrated but the four expected
 * triggers (new-follower / dm-received / mentioned / follow-request)
 * never fired. This module is the missing dispatch surface.
 *
 * Usage from API routes:
 *   import { notifySocialEvent } from '@/lib/social/notify';
 *   await notifySocialEvent({
 *     recipient_id: targetId,
 *     event: 'new_follower',
 *     metadata: { follower_id, follower_username },
 *   });
 *
 * Writes a row to `notifications` (the existing in-app feed) when the
 * recipient's prefs allow it. Telegram + push delivery piggybacks on
 * the existing /api/notifications POST endpoint behaviour which the
 * notification system already dedupes + queues.
 */

export type SocialEvent =
  | 'new_follower'        // someone followed you
  | 'follow_request'      // someone wants to follow your private account
  | 'dm_received'         // new DM (no plaintext preview — encrypted)
  | 'mentioned';          // someone @-mentioned you in a post / DM

interface NotifyInput {
  recipient_id: string;
  event: SocialEvent;
  metadata?: Record<string, unknown>;
}

const PREF_COLUMN: Record<SocialEvent, string> = {
  new_follower:   'notify_new_follower',
  follow_request: 'notify_follow_request',
  dm_received:    'notify_dm_received',
  mentioned:      'notify_mentioned',
};

const TITLE: Record<SocialEvent, string> = {
  new_follower:   'New follower',
  follow_request: 'Follow request',
  dm_received:    'New message',
  mentioned:      'Mentioned you',
};

export async function notifySocialEvent({ recipient_id, event, metadata }: NotifyInput): Promise<void> {
  const sb = getSupabaseAdmin();
  // Honor the per-event toggle on social_notification_preferences. If
  // the row doesn't exist yet, default to true (the table defaults are
  // all true for the four social toggles).
  const { data: prefs } = await sb
    .from('social_notification_preferences')
    .select(PREF_COLUMN[event])
    .eq('user_id', recipient_id)
    .maybeSingle();
  const enabled = prefs ? Boolean((prefs as unknown as Record<string, unknown>)[PREF_COLUMN[event]]) : true;
  if (!enabled) return;

  // Suspended-from-social users shouldn't receive social notifs.
  const { data: profile } = await sb
    .from('profiles')
    .select('social_suspended_until')
    .eq('id', recipient_id)
    .maybeSingle();
  if (profile?.social_suspended_until && new Date(profile.social_suspended_until) > new Date()) return;

  await sb.from('notifications').insert({
    user_id: recipient_id,
    type: `social.${event}`,
    title: TITLE[event],
    metadata: metadata ?? {},
    read: false,
  });
  // The existing notification cron + telegram digest will pick this up
  // and fan out per the user's channel preferences in
  // notification_settings. We deliberately do not call telegram or push
  // here directly — keeps the dispatch surface single-write.
}
