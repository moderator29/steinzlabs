import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createUserNotification } from '@/lib/social/subscriberNotify';

/**
 * Weekly recap notifier. Finds every user who made at least one coin_trade in
 * the last 7 days and pings them that their trading week is ready, linking to
 * their shareable recap. The owner registers this in dispatch (weekly / twice a
 * week); it is idempotent-ish by design: notifying once per matched user per run
 * is fine, and a user who did not trade this week is simply skipped.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  // Registered in the twice-daily dispatch, but a recap is a WEEKLY beat. Gate
  // to the Sunday 00:00 UTC run so each user gets one recap ping per week, not
  // one every dispatch. `?force=1` bypasses the gate for manual testing.
  const now = new Date();
  const force = req.nextUrl.searchParams.get('force') === '1';
  if (!force && (now.getUTCDay() !== 0 || now.getUTCHours() >= 6)) {
    return cronResponse('coin-weekly-recap', startedAt, { skipped: 'not-weekly-slot' });
  }

  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  // Distinct traders in the window. We only pull user_id + created_at so a busy
  // week stays cheap, then dedupe in memory.
  const { data, error } = await admin
    .from('coin_trades')
    .select('user_id')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50000);
  if (error) {
    Sentry.captureException(error, { tags: { cron: 'coin-weekly-recap' } });
    return cronResponse('coin-weekly-recap', startedAt, { error: error.message });
  }

  const userIds = [...new Set(((data as Array<{ user_id: string }>) ?? []).map((r) => r.user_id).filter(Boolean))];
  if (userIds.length === 0) return cronResponse('coin-weekly-recap', startedAt, { users: 0 });

  // Respect the holdings privacy gate: a user who hid their holdings should not
  // get pushed a recap link that would render a private card anyway.
  const handleById = new Map<string, string>();
  const { data: profs } = await admin
    .from('profiles')
    .select('id, username, show_holdings')
    .in('id', userIds);
  for (const p of (profs as Array<{ id: string; username: string | null; show_holdings: boolean | null }>) ?? []) {
    if (p.show_holdings === false) continue;
    handleById.set(p.id, p.username || '');
  }

  let notified = 0;
  const results = await Promise.allSettled(
    [...handleById.entries()].map(([userId, username]) => {
      const url = username ? `/${encodeURIComponent(username)}?recap=week` : '/dashboard/coins';
      return createUserNotification({
        userId,
        type: 'coins.weekly_recap',
        title: 'Your trading week is ready',
        body: 'See your realized PnL, best coin and win rate. Tap to view and share your weekly recap.',
        url,
        metadata: { kind: 'weekly_recap' },
      });
    }),
  );
  for (const r of results) if (r.status === 'fulfilled') notified += 1;

  return cronResponse('coin-weekly-recap', startedAt, { users: userIds.length, notified });
}
