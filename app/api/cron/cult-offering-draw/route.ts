import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCron, cronResponse, logCronExecution, withCronErrorReporting } from '@/app/api/cron/_shared';

/**
 * Auto-draws expired Offerings.
 *
 * For every open offering whose closes_at has passed: pick a uniformly-random
 * entrant as the winner (status='drawn'), or close it with no winner if nobody
 * entered (status='closed'). Idempotent — only touches still-open offerings.
 *
 * Runs every 15 minutes so draws land close to their close time.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  return await withCronErrorReporting('cult-offering-draw', startedAt, async () => {
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: expired } = await admin
      .from('cult_offerings')
      .select('id')
      .eq('status', 'open')
      .not('closes_at', 'is', null)
      .lte('closes_at', nowIso)
      .limit(50);

    let drawn = 0;
    let closedEmpty = 0;
    for (const o of expired ?? []) {
      const { data: entries } = await admin
        .from('cult_offering_entries')
        .select('user_id')
        .eq('offering_id', o.id);

      if (!entries || entries.length === 0) {
        await admin.from('cult_offerings').update({ status: 'closed', drawn_at: nowIso }).eq('id', o.id);
        closedEmpty += 1;
        continue;
      }

      // Uniform pick. Math.random is fine here — this is a route, not a
      // resume-able workflow script.
      const winner = entries[Math.floor(Math.random() * entries.length)].user_id;
      const { error } = await admin
        .from('cult_offerings')
        .update({ status: 'drawn', winner_user_id: winner, drawn_at: nowIso })
        .eq('id', o.id)
        .eq('status', 'open'); // guard against a double-draw race
      if (!error) drawn += 1;
    }

    await logCronExecution('cult-offering-draw', 'success', Date.now() - startedAt, undefined, drawn);
    return cronResponse('cult-offering-draw', startedAt, { expired: (expired ?? []).length, drawn, closedEmpty });
  });
}
