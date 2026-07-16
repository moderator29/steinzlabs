import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { queueTelegramNotification } from '@/lib/telegram/notify';

/**
 * Per-user notify fanout. Users can turn ON notifications for a specific person
 * (the profile "bell") via user_notify_subscriptions. When that person posts, or
 * comes online, everyone who subscribed gets an in-app notification, plus a
 * Telegram push if they connected Telegram. Fire-and-forget: never throws.
 */

interface CreateInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  url: string;
  metadata?: Record<string, unknown>;
  telegram?: boolean;
}

/** One in-app notification (+ optional Telegram). Best-effort. */
export async function createUserNotification(input: CreateInput): Promise<void> {
  const sb = getSupabaseAdmin();
  try {
    await sb.from('notifications').insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url,
      metadata: input.metadata ?? {},
      read: false,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'subscriberNotify', step: 'insert' } });
  }
  if (input.telegram !== false) {
    try {
      queueTelegramNotification({ userId: input.userId, kind: 'general', title: input.title, body: input.body, url: `https://nakalabs.xyz${input.url}` });
    } catch (err) {
      Sentry.captureException(err, { tags: { source: 'subscriberNotify', step: 'telegram' } });
    }
  }
}

/** Notify everyone subscribed to `authorId` that they published a new wire. */
export async function notifyNewPostToSubscribers(opts: {
  authorId: string;
  authorName: string;
  postId: string;
  snippet: string;
}): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { data: subs } = await sb
      .from('user_notify_subscriptions')
      .select('subscriber_id')
      .eq('target_id', opts.authorId)
      .eq('notify_posts', true)
      .limit(1000);
    const recipients = (subs ?? []).map((s) => s.subscriber_id as string).filter((id) => id !== opts.authorId);
    const body = opts.snippet ? (opts.snippet.length > 140 ? opts.snippet.slice(0, 139) + '…' : opts.snippet) : 'Posted a new wire.';
    await Promise.allSettled(
      recipients.map((userId) =>
        createUserNotification({
          userId,
          type: 'user.new_post',
          title: `${opts.authorName} posted`,
          body,
          url: `/wire/${opts.postId}`,
          metadata: { author_id: opts.authorId, post_id: opts.postId },
        }),
      ),
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'subscriberNotify', step: 'new_post' } });
  }
}

/** Notify everyone with a comes-online subscription that `userId` is online. */
export async function notifyCameOnline(opts: { userId: string; name: string; username: string | null }): Promise<number> {
  try {
    const sb = getSupabaseAdmin();
    const { data: subs } = await sb
      .from('user_notify_subscriptions')
      .select('subscriber_id')
      .eq('target_id', opts.userId)
      .eq('notify_online', true)
      .limit(1000);
    const recipients = (subs ?? []).map((s) => s.subscriber_id as string).filter((id) => id !== opts.userId);
    const url = opts.username ? `/u/${opts.username}` : '/dashboard/notifications';
    await Promise.allSettled(
      recipients.map((userId) =>
        createUserNotification({
          userId,
          type: 'user.online',
          title: `${opts.name} is online`,
          body: `${opts.name} just came online.`,
          url,
          metadata: { user_id: opts.userId },
        }),
      ),
    );
    return recipients.length;
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'subscriberNotify', step: 'came_online' } });
    return 0;
  }
}
