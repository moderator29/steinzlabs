import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTelegramMessage } from '@/lib/telegram/client';

/**
 * TG3: re-attempts failed Telegram deliveries from
 * telegram_delivery_failures with exponential backoff 1h → 24h → 7d.
 * Distinct from Branch 9's pending_telegram_messages (which queues
 * digest sends) — this queue exists for individual notification
 * deliveries that failed at write time.
 *
 * Backoff is keyed on `attempts`: the original send made attempt 1
 * (and queued on failure). Retries:
 *   attempt 2 → +1h
 *   attempt 3 → +24h
 *   attempt 4 → +7d
 *   attempt 5 → give up, stamp resolved_at + last error.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAME = 'telegram-retry-failures';
const BACKOFF_MS = [60 * 60 * 1000, 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];

function nextDelay(attemptsAfter: number): number | null {
  return BACKOFF_MS[attemptsAfter - 2] ?? null;       // attempts >=2 are retries
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  const admin = getSupabaseAdmin();
  let delivered = 0;
  let rescheduled = 0;
  let permanent = 0;

  try {
    // TG4 + retry honor the kill switch.
    const { data: settings } = await admin
      .from('platform_settings')
      .select('telegram_paused')
      .limit(1)
      .maybeSingle<{ telegram_paused: boolean | null }>();
    if (settings?.telegram_paused) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, 'paused', 0);
      return NextResponse.json({ ok: true, paused: true });
    }

    // Pick rows whose last attempt is old enough to retry. The pending
    // delay isn't stored as next_retry_at on this table, so we apply
    // the backoff window on read: last_attempt_at + delay <= now().
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await admin
      .from('telegram_delivery_failures')
      .select('id, chat_id, title, body, url, attempts, last_attempt_at, kind, user_id')
      .is('resolved_at', null)
      .gt('created_at', since7d)            // anything older than 7d is dead anyway
      .order('last_attempt_at', { ascending: true })
      .limit(100);

    for (const r of (rows ?? []) as Array<{
      id: string; chat_id: number | string; title: string | null;
      body: string | null; url: string | null; attempts: number | null;
      last_attempt_at: string | null; kind: string | null; user_id: string | null;
    }>) {
      const attempts = Number(r.attempts ?? 1);
      const delay = nextDelay(attempts + 1);
      if (delay === null) {
        // Already attempted enough times — give up.
        await admin.from('telegram_delivery_failures').update({
          resolved_at: new Date().toISOString(),
          error_message: 'gave up after 4 retries',
        }).eq('id', r.id);
        permanent++;
        continue;
      }
      const lastAt = r.last_attempt_at ? new Date(r.last_attempt_at).getTime() : 0;
      const dueAt = lastAt + (BACKOFF_MS[attempts - 1] ?? 0);
      if (dueAt > Date.now()) continue;     // not due yet — skip until next tick

      const message =
        `*${r.title ?? 'Naka Labs'}*\n${r.body ?? ''}` + (r.url ? `\n\n${r.url}` : '');
      const ok = await sendTelegramMessage(Number(r.chat_id), message).catch(() => false);

      if (ok) {
        await admin.from('telegram_delivery_failures').update({
          resolved_at: new Date().toISOString(),
          attempts: attempts + 1,
          last_attempt_at: new Date().toISOString(),
        }).eq('id', r.id);
        delivered++;
      } else {
        await admin.from('telegram_delivery_failures').update({
          attempts: attempts + 1,
          last_attempt_at: new Date().toISOString(),
          error_message: 'retry send returned false',
        }).eq('id', r.id);
        rescheduled++;
      }
    }

    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, delivered);
    return NextResponse.json({ ok: true, delivered, rescheduled, permanent });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, delivered);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
