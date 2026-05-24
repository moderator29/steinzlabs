import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTelegramMessage } from '@/lib/telegram/client';
import { sendDiscordWebhook, sendTwilioSMS } from '@/lib/notifications/channels';

/**
 * Picks up rows from pending_telegram_messages / pending_discord_messages
 * / pending_sms_messages whose next_retry_at <= now() and retries the
 * delivery. Exponential backoff: 1h → 24h → 7d → drop (mark delivered_at
 * with last_error stamped, so the row stays for audit).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAME = 'notification-retry';
const BACKOFF_MS = [60 * 60 * 1000, 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];

function nextBackoff(attemptsSoFar: number): number | null {
  // attemptsSoFar is 1 after the original send + first retry insert.
  // We allow 3 retries total: indices 0..2 of BACKOFF_MS.
  return BACKOFF_MS[attemptsSoFar - 1] ?? null;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  let delivered = 0;
  let permanent = 0;
  let rescheduled = 0;

  try {
    // Telegram
    const { data: tgRows } = await admin
      .from('pending_telegram_messages')
      .select('id, chat_id, body, attempts')
      .is('delivered_at', null)
      .lte('next_retry_at', nowIso)
      .limit(100);
    for (const r of (tgRows ?? []) as Array<{ id: string; chat_id: number | string; body: string; attempts: number }>) {
      const ok = await sendTelegramMessage(Number(r.chat_id), r.body).catch(() => false);
      if (ok) {
        await admin.from('pending_telegram_messages').update({ delivered_at: nowIso }).eq('id', r.id);
        delivered++;
      } else {
        const nextDelay = nextBackoff(r.attempts + 1);
        if (nextDelay == null) {
          await admin.from('pending_telegram_messages').update({ delivered_at: nowIso, last_error: 'gave up after 3 retries' }).eq('id', r.id);
          permanent++;
        } else {
          await admin.from('pending_telegram_messages').update({
            attempts: r.attempts + 1,
            next_retry_at: new Date(Date.now() + nextDelay).toISOString(),
          }).eq('id', r.id);
          rescheduled++;
        }
      }
    }

    // Discord
    const { data: dRows } = await admin
      .from('pending_discord_messages')
      .select('id, webhook_url, payload, attempts')
      .is('delivered_at', null)
      .lte('next_retry_at', nowIso)
      .limit(100);
    for (const r of (dRows ?? []) as Array<{ id: string; webhook_url: string; payload: Record<string, unknown>; attempts: number }>) {
      const res = await sendDiscordWebhook(r.webhook_url, r.payload as { username: string; embeds: Array<Record<string, unknown>> });
      if (res.ok) {
        await admin.from('pending_discord_messages').update({ delivered_at: nowIso }).eq('id', r.id);
        delivered++;
      } else {
        const nextDelay = nextBackoff(r.attempts + 1);
        if (nextDelay == null) {
          await admin.from('pending_discord_messages').update({ delivered_at: nowIso, last_error: `gave up: ${res.error}` }).eq('id', r.id);
          permanent++;
        } else {
          await admin.from('pending_discord_messages').update({
            attempts: r.attempts + 1,
            next_retry_at: new Date(Date.now() + nextDelay).toISOString(),
            last_error: res.error,
          }).eq('id', r.id);
          rescheduled++;
        }
      }
    }

    // SMS
    const { data: sRows } = await admin
      .from('pending_sms_messages')
      .select('id, phone, body, attempts')
      .is('delivered_at', null)
      .lte('next_retry_at', nowIso)
      .limit(50);
    for (const r of (sRows ?? []) as Array<{ id: string; phone: string; body: string; attempts: number }>) {
      const res = await sendTwilioSMS(r.phone, r.body);
      if (res.ok) {
        await admin.from('pending_sms_messages').update({ delivered_at: nowIso }).eq('id', r.id);
        delivered++;
      } else {
        const nextDelay = nextBackoff(r.attempts + 1);
        if (nextDelay == null) {
          await admin.from('pending_sms_messages').update({ delivered_at: nowIso, last_error: `gave up: ${res.error}` }).eq('id', r.id);
          permanent++;
        } else {
          await admin.from('pending_sms_messages').update({
            attempts: r.attempts + 1,
            next_retry_at: new Date(Date.now() + nextDelay).toISOString(),
            last_error: res.error,
          }).eq('id', r.id);
          rescheduled++;
        }
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
