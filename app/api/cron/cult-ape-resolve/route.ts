import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { currentPairPrice } from '@/lib/cult/convictionPrice';
import { verifyCron, cronResponse, logCronExecution, withCronErrorReporting } from '@/app/api/cron/_shared';

/**
 * Resolves due "Ape or Nope" rounds. Re-prices the round's pair, computes the
 * 24h move, sets the outcome (ape if up, nope if down, flat within a deadband),
 * grades every vote, awards points + streaks, and fires a Signal Pulse with
 * the result so the call threads back into the cult feed. Real prices only —
 * an unpriceable round is left to retry next run.
 *
 * Schedule: every 15m (catches rounds the moment their 24h window closes).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const WIN_POINTS = 10;
const DEADBAND = 0.5; // ±0.5% → flat (push, streak untouched)

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  return await withCronErrorReporting('cult-ape-resolve', startedAt, async () => {
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: due } = await admin
      .from('cult_ape_rounds')
      .select('id, symbol, entry_price_usd, pair_ref, pair_chain')
      .eq('status', 'open')
      .lte('resolves_at', nowIso)
      .limit(20);

    let resolvedCount = 0;
    for (const r of due ?? []) {
      const entry = Number(r.entry_price_usd);
      if (!Number.isFinite(entry) || entry <= 0 || !r.pair_ref || !r.pair_chain) {
        await admin.from('cult_ape_rounds')
          .update({ status: 'resolved', outcome: 'flat', resolved_at: nowIso })
          .eq('id', r.id)
          .eq('status', 'open');
        continue;
      }
      const cur = await currentPairPrice(String(r.pair_chain), String(r.pair_ref));
      if (cur == null) continue; // unreachable pair — retry next run

      const movePct = ((cur - entry) / entry) * 100;
      const outcome = movePct > DEADBAND ? 'ape' : movePct < -DEADBAND ? 'nope' : 'flat';
      const moveRounded = Math.round(movePct * 10) / 10;

      // Atomically claim the round before grading. The status='open' guard
      // makes this idempotent: if a concurrent/overlapping cron run (or a
      // retry) already resolved this round, no row is returned and we skip,
      // so points and streaks are never awarded twice for the same round.
      const { data: claimed } = await admin.from('cult_ape_rounds').update({
        status: 'resolved',
        resolve_price_usd: cur,
        move_pct: moveRounded,
        outcome,
        resolved_at: nowIso,
      }).eq('id', r.id).eq('status', 'open').select('id');
      if (!claimed || claimed.length === 0) continue;

      const { data: votes } = await admin
        .from('cult_ape_votes')
        .select('id, user_id, choice')
        .eq('round_id', r.id);

      for (const v of votes ?? []) {
        if (outcome === 'flat') {
          await admin.from('cult_ape_votes').update({ correct: null, points_awarded: 0 }).eq('id', v.id);
          continue; // push — streak unchanged
        }
        const correct = v.choice === outcome;
        await admin.from('cult_ape_votes')
          .update({ correct, points_awarded: correct ? WIN_POINTS : 0 })
          .eq('id', v.id);

        const { data: prof } = await admin
          .from('profiles')
          .select('cult_points, cult_streak, cult_best_streak')
          .eq('id', v.user_id)
          .maybeSingle<{ cult_points: number | null; cult_streak: number | null; cult_best_streak: number | null }>();
        const points = (prof?.cult_points ?? 0) + (correct ? WIN_POINTS : 0);
        const streak = correct ? (prof?.cult_streak ?? 0) + 1 : 0;
        const best = Math.max(prof?.cult_best_streak ?? 0, streak);
        await admin.from('profiles')
          .update({ cult_points: points, cult_streak: streak, cult_best_streak: best })
          .eq('id', v.user_id);
      }

      if (outcome !== 'flat') {
        const moveStr = `${moveRounded >= 0 ? '+' : ''}${moveRounded}%`;
        await admin.from('cult_signals').insert({
          kind: 'ape_or_nope',
          title: `Ape or Nope: $${r.symbol} ${outcome === 'ape' ? 'pumped' : 'dumped'} ${moveStr}`,
          detail: { message: `The cult's 24h call on $${r.symbol} resolved ${outcome.toUpperCase()} (${moveStr}).` },
          severity: outcome === 'ape' ? 'watch' : 'info',
        });
      }
      resolvedCount += 1;
    }

    await logCronExecution('cult-ape-resolve', 'success', Date.now() - startedAt, undefined, resolvedCount);
    return cronResponse('cult-ape-resolve', startedAt, { due: (due ?? []).length, resolved: resolvedCount });
  });
}
