import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluateSentinel, type SentinelRow } from '@/lib/sentinel/evaluate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// VTX Sentinel monitor — walks every active sentinel, autonomously evaluates its
// target against live data, and drops a notification ONLY when something real
// changed vs the recorded baseline. Exits instantly when no sentinels exist.

const NAME = 'vtx-sentinel';
const MAX_PER_TICK = 200;

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('vtx_sentinels')
      .select('id, user_id, target_type, target, chain, label, last_checked_at, last_snapshot')
      .eq('active', true)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(MAX_PER_TICK);
    if (error) {
      await logCronExecution(NAME, 'failed', Date.now() - startedAt, error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    const sentinels = (data ?? []) as SentinelRow[];
    if (sentinels.length === 0) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, checked: 0 });
    }

    let notified = 0;
    for (const s of sentinels) {
      try {
        const { changes, snapshot } = await evaluateSentinel(admin, s);
        if (changes.length > 0) {
          const label = s.label || `${s.target_type} ${s.target.slice(0, 6)}…${s.target.slice(-4)}`;
          const url = s.target_type === 'token'
            ? `/dashboard/market?token=${encodeURIComponent(s.target)}&chain=${s.chain}`
            : `/dashboard/wallet-intelligence?address=${encodeURIComponent(s.target)}&chain=${s.chain}`;
          await admin.from('notifications').insert({
            user_id: s.user_id,
            type: 'sentinel.alert',
            title: `Sentinel: ${label}`,
            body: changes.join(' '),
            url,
            metadata: { sentinel_id: s.id, target: s.target, chain: s.chain, changes },
            read: false,
          });
          notified++;
        }
        await admin.from('vtx_sentinels')
          .update({ last_checked_at: new Date().toISOString(), last_snapshot: snapshot })
          .eq('id', s.id);
      } catch (err) {
        // Isolate per-sentinel failures so one bad target can't abort the tick.
        Sentry.captureException(err, { tags: { cron: NAME, sentinel: s.id } });
      }
    }

    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, notified);
    return NextResponse.json({ ok: true, checked: sentinels.length, notified });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
