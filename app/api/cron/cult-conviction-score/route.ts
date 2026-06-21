import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { currentPairPrice } from '@/lib/cult/convictionPrice';
import { verifyCron, cronResponse, logCronExecution, withCronErrorReporting } from '@/app/api/cron/_shared';

/**
 * Scores due Conviction Board calls.
 *
 * A call is eligible once resolve_at has passed (7 days after posting) and it
 * captured an entry price + pair. Score = price move % since entry, signed by
 * direction (long: +move, short: -move). Sets status='scored' + resolved_at so
 * the leaderboard fills with real, outcome-based reputation.
 *
 * Runs daily. Calls with no captured price are left open (never fake-scored).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  return await withCronErrorReporting('cult-conviction-score', startedAt, async () => {
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: due } = await admin
      .from('cult_convictions')
      .select('id, direction, entry_price_usd, pair_ref, pair_chain')
      .eq('status', 'open')
      .lte('resolve_at', nowIso)
      .not('entry_price_usd', 'is', null)
      .not('pair_ref', 'is', null)
      .limit(200);

    let scored = 0;
    for (const c of due ?? []) {
      const entry = Number(c.entry_price_usd);
      if (!Number.isFinite(entry) || entry <= 0) continue;
      const cur = await currentPairPrice(String(c.pair_chain), String(c.pair_ref));
      if (cur == null) continue; // pair gone / unreachable — leave open, try next run

      const movePct = ((cur - entry) / entry) * 100;
      const score = Math.round((c.direction === 'short' ? -movePct : movePct) * 10) / 10;

      const { error } = await admin
        .from('cult_convictions')
        .update({ status: 'scored', score, resolved_at: nowIso })
        .eq('id', c.id);
      if (!error) scored += 1;
    }

    await logCronExecution('cult-conviction-score', 'success', Date.now() - startedAt, undefined, scored);
    return cronResponse('cult-conviction-score', startedAt, { eligible: (due ?? []).length, scored });
  });
}
