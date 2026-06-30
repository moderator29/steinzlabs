import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUser } from '@/lib/services/webpush';
import { queueTelegramNotification } from '@/lib/telegram/notify';

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
 * recipient's prefs allow it, then fans the event out to web push, email,
 * and Telegram per the recipient's social_notification_preferences. Every
 * external channel is best-effort and independently try/caught — one
 * channel failing never blocks the others or the in-app insert, and this
 * function never throws to its callers.
 *
 * A `dedup_key` is folded into metadata so retries / double-fires don't
 * duplicate (a partial index on metadata->>'dedup_key' backs a pre-insert
 * existence check within a short window).
 */

export type SocialEvent =
  | 'new_follower'           // someone followed you
  | 'follow_request'         // someone wants to follow your private account
  | 'dm_received'            // new DM in an accepted conversation
  | 'dm_request'             // a message request from someone you don't follow
  | 'dm_request_accepted'    // your message request was accepted
  | 'mentioned';             // someone @-mentioned you in a post / DM

interface NotifyInput {
  recipient_id: string;
  event: SocialEvent;
  metadata?: Record<string, unknown>;
}

// Maps each event to the social_notification_preferences toggle column.
const PREF_COLUMN: Record<SocialEvent, string> = {
  new_follower:        'notify_new_follower',
  follow_request:      'notify_follow_request',
  dm_received:         'notify_dm_received',
  dm_request:          'notify_dm_received',
  dm_request_accepted: 'notify_dm_received',
  mentioned:           'notify_mentioned',
};

const TITLE: Record<SocialEvent, string> = {
  new_follower:        'New follower',
  follow_request:      'Follow request',
  dm_received:         'New message',
  dm_request:          'Message request',
  dm_request_accepted: 'Request accepted',
  mentioned:           'Mentioned you',
};

// notifications.body is NOT NULL — every insert must supply it.
const BODY: Record<SocialEvent, string> = {
  new_follower:        'Someone started following you.',
  follow_request:      'Someone requested to follow you.',
  dm_received:         'You received a new message.',
  dm_request:          'Someone wants to message you.',
  dm_request_accepted: 'Your message request was accepted.',
  mentioned:           'Someone mentioned you.',
};

/** Build the in-app click-through URL for a social notification so the bell
 *  and notifications page route the user to the right surface. */
function urlForEvent(event: SocialEvent, metadata?: Record<string, unknown>): string {
  const m = metadata ?? {};
  const senderId = (m.sender_id ?? m.peer_id ?? m.follower_id) as string | undefined;
  switch (event) {
    case 'dm_received':
      return senderId ? `/dashboard/messages/${senderId}` : '/dashboard/messages';
    case 'dm_request':
      return '/dashboard/messages'; // Requests tab lives in the inbox
    case 'dm_request_accepted':
      return senderId ? `/dashboard/messages/${senderId}` : '/dashboard/messages';
    case 'new_follower':
    case 'follow_request':
      return m.follower_username ? `/u/${m.follower_username}` : '/dashboard/notifications';
    default:
      return '/dashboard/notifications';
  }
}

// Channel-level prefs on social_notification_preferences. These gate the
// out-of-app fanout independently from the per-event in-app toggle.
const CHANNEL_PREF = {
  push:     'push_notifications',
  email:    'email_notifications',
  telegram: 'telegram_notifications',
} as const;

// Map a social event onto the telegram dispatcher's coarse "kind".
const TELEGRAM_KIND: Record<SocialEvent, 'general'> = {
  new_follower:        'general',
  follow_request:      'general',
  dm_received:         'general',
  dm_request:          'general',
  dm_request_accepted: 'general',
  mentioned:           'general',
};

// Dedup window — a retry/double-fire of the same logical event inside this
// span collapses onto the first insert (the metadata->>'dedup_key' index
// makes the lookup cheap).
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/** Build the stable dedup key for an event: `${event}:${actorId}:${conversationId||''}`.
 *  Falls back across the metadata id fields the various call-sites supply. */
function buildDedupKey(event: SocialEvent, metadata?: Record<string, unknown>): string {
  const m = metadata ?? {};
  const actorId = (m.follower_id ?? m.sender_id ?? m.peer_id ?? m.actor_id ?? '') as string;
  const conversationId = (m.conversation_id ?? m.peer_id ?? '') as string;
  return `${event}:${actorId}:${conversationId}`;
}

export async function notifySocialEvent({ recipient_id, event, metadata }: NotifyInput): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    // Honor the per-event toggle on social_notification_preferences. If
    // the row doesn't exist yet, default to true (the table defaults are
    // all true for the four social toggles). Also read the channel-level
    // toggles so we know which out-of-app channels to fan out to.
    const { data: prefs } = await sb
      .from('social_notification_preferences')
      .select(`${PREF_COLUMN[event]}, ${CHANNEL_PREF.push}, ${CHANNEL_PREF.email}, ${CHANNEL_PREF.telegram}`)
      .eq('user_id', recipient_id)
      .maybeSingle();
    const prefRow = (prefs ?? {}) as Record<string, unknown>;
    const enabled = prefs ? Boolean(prefRow[PREF_COLUMN[event]]) : true;
    if (!enabled) return;

    // Suspended-from-social users shouldn't receive social notifs.
    const { data: profile } = await sb
      .from('profiles')
      .select('social_suspended_until')
      .eq('id', recipient_id)
      .maybeSingle();
    if (profile?.social_suspended_until && new Date(profile.social_suspended_until) > new Date()) return;

    const dedupKey = buildDedupKey(event, metadata);
    const title = TITLE[event];
    const body = BODY[event];
    const url = urlForEvent(event, metadata);

    // Pre-insert existence check on the dedup key (within a short window). A
    // retry of the same logical event collapses onto the first row so we don't
    // double in-app-insert OR double-fan-out push/email/telegram.
    const sinceIso = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: existing } = await sb
      .from('notifications')
      .select('id')
      .eq('user_id', recipient_id)
      .eq('type', `social.${event}`)
      .gte('created_at', sinceIso)
      .eq('metadata->>dedup_key', dedupKey)
      .limit(1);
    if (existing && existing.length > 0) return;

    await sb.from('notifications').insert({
      user_id: recipient_id,
      type: `social.${event}`,
      title,
      body,
      url,
      metadata: { ...(metadata ?? {}), dedup_key: dedupKey },
      read: false,
    });

    // Out-of-app fanout. Only dm_received + new_follower get the loud push /
    // email / telegram treatment (the audit's two priority events); the rest
    // stay in-app only. Each channel is independently try/caught and gated on
    // its social_notification_preferences toggle (defaulting on when no row).
    const wantsFanout = event === 'dm_received' || event === 'new_follower';
    if (!wantsFanout) return;

    const pushOn     = prefs ? prefRow[CHANNEL_PREF.push] !== false     : true;
    const emailOn    = prefs ? prefRow[CHANNEL_PREF.email] !== false    : true;
    const telegramOn = prefs ? prefRow[CHANNEL_PREF.telegram] !== false : true;

    if (pushOn) {
      try {
        await sendPushToUser(recipient_id, { title, body, url, tag: `social-${event}`, data: { dedup_key: dedupKey } });
      } catch (err) {
        Sentry.captureException(err, { tags: { source: 'social/notify', channel: 'push', event } });
      }
    }

    if (emailOn) {
      try {
        // fanOutNotification writes its own in-app row plus discord/sms/email.
        // We want only the email side here (the in-app row is already written
        // above), but reusing it keeps email delivery on the maintained path;
        // the extra in-app row is harmless and dedup-tagged downstream callers
        // ignore. To avoid a duplicate in-app feed entry we go straight to the
        // email primitive instead.
        const { sendEmail } = await import('@/lib/email/resend');
        const { data: emailRow } = await sb
          .from('profiles')
          .select('email, settings')
          .eq('id', recipient_id)
          .maybeSingle<{ email: string | null; settings: Record<string, unknown> | null }>();
        const emailAllowed = emailRow?.email
          && (emailRow.settings as { email_alerts_enabled?: boolean } | null)?.email_alerts_enabled !== false;
        if (emailAllowed && emailRow?.email) {
          await sendEmail({
            to: emailRow.email,
            from: process.env.RESEND_FROM_EMAIL ?? 'alerts@nakalabs.xyz',
            subject: title,
            html: `<p>${body}</p>${url ? `<p><a href="https://nakalabs.xyz${url}">Open in Naka</a></p>` : ''}<p style="color:#94a3b8;font-size:12px;">NakaLabs · <a href="https://nakalabs.xyz">nakalabs.xyz</a></p>`,
          });
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { source: 'social/notify', channel: 'email', event } });
      }
    }

    if (telegramOn) {
      try {
        queueTelegramNotification({
          userId: recipient_id,
          kind: TELEGRAM_KIND[event],
          title,
          body,
          url: url ? `https://nakalabs.xyz${url}` : undefined,
        });
      } catch (err) {
        Sentry.captureException(err, { tags: { source: 'social/notify', channel: 'telegram', event } });
      }
    }
  } catch (err) {
    // Never throw to callers — social notify is always fire-and-forget.
    Sentry.captureException(err, { tags: { source: 'social/notify', event } });
  }
}
