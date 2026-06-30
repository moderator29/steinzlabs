/**
 * #68 Market-Maker engine cron. Runs every ~2 min (frequent dispatch). For each
 * active strategy, runs one conservative grid tick through the AA session-key
 * executor (capped, non-custodial). Serialized by the cron lock so overlapping
 * ticks can't double-fill, and short-circuits instantly when no strategy is active.
 */
import { NextRequest } from 'next/server';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { runMarketMaker } from '@/lib/marketMaker/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const sb = getSupabaseAdmin();
  const { count } = await sb.from('mm_strategies').select('id', { count: 'exact', head: true }).eq('status', 'active');
  if (!count) return cronResponse('mm-engine', startedAt, { active: 0, noWork: true });

  const { data: lockOk } = await sb.rpc('try_acquire_cron_lock', { p_name: 'mm-engine', p_ttl_seconds: 110 });
  if (!lockOk) return cronResponse('mm-engine', startedAt, { active: count, skipped: 'another tick is running' });

  try {
    const res = await runMarketMaker();
    const fills = res.results.filter((r) => r.action === 'buy' || r.action === 'sell').length;
    await logCronExecution('mm-engine', 'success', Date.now() - startedAt, undefined, fills);
    return cronResponse('mm-engine', startedAt, { active: res.active, fills, results: res.results.slice(0, 20) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logCronExecution('mm-engine', 'failed', Date.now() - startedAt, message);
    return cronResponse('mm-engine', startedAt, { error: message }, 500);
  } finally {
    await sb.rpc('release_cron_lock', { p_name: 'mm-engine' });
  }
}
