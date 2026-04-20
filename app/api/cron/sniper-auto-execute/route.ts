/**
 * §6.1: Sniper auto-execute worker.
 *
 * Picks up sniper_match_events with decision='sniped_pending' and
 * actually executes the buy via the trade-execute pipeline. Conditional
 * early-exit: if zero pending matches, returns in <100ms with no
 * external calls — Vercel still bills the invocation but at basically
 * nothing vs. a full run.
 *
 * Why separate from /api/cron/sniper-monitor: monitor DETECTS matches,
 * this cron EXECUTES. Keeps each cron tick within Vercel's 300s cap and
 * lets us tune their cadences independently (detection fires every 5min,
 * execution every 1min so latency stays low once a match lands).
 *
 * Execution path: insert a row into pending_trades with user_id +
 * token + amountUSD from the match's criteria, then the existing
 * pending-trade prep/execute pipeline takes it from there. We do NOT
 * touch 0x directly — reuse the pipeline so retries + security scan +
 * logging all happen the same way as manual trades.
 */
import { NextRequest } from 'next/server';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  const adminOverride = request.headers.get('x-migration-secret') === process.env.ADMIN_MIGRATION_SECRET;
  if (!auth.ok && !adminOverride) return auth.response!;

  const url = request.nextUrl;
  const dryRun = url.searchParams.get('dryRun') === '1';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10) || 5, 20);

  const supabase = getSupabaseAdmin();

  // Conditional early-exit — check for pending matches in a single
  // count-only query. If zero, return immediately without loading a row
  // or calling any external service. This is the whole cost-optimization.
  const { count } = await supabase
    .from('sniper_match_events')
    .select('*', { count: 'exact', head: true })
    .eq('decision', 'sniped_pending')
    .is('executed_tx_hash', null)
    .is('pending_trade_id', null);

  if (!count) {
    return cronResponse('sniper-auto-execute', startedAt, { pending: 0, noWork: true });
  }

  const { data: matches, error } = await supabase
    .from('sniper_match_events')
    .select('id, criteria_id, user_id, matched_token_address, matched_chain, details')
    .eq('decision', 'sniped_pending')
    .is('executed_tx_hash', null)
    .is('pending_trade_id', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    await logCronExecution('sniper-auto-execute', 'failed', Date.now() - startedAt, error.message);
    return cronResponse('sniper-auto-execute', startedAt, { error: error.message });
  }

  if (!matches || matches.length === 0) {
    return cronResponse('sniper-auto-execute', startedAt, { pending: 0 });
  }

  // Resolve criteria (amount + slippage + user wallet) in a single query.
  const criteriaIds = Array.from(new Set(matches.map((m) => m.criteria_id)));
  const { data: criteriaRows } = await supabase
    .from('sniper_criteria')
    .select('id, amount_usd, slippage_bps, wallet_address, active, user_id')
    .in('id', criteriaIds);
  const criteriaMap = new Map((criteriaRows ?? []).map((c) => [c.id, c]));

  const processed: Array<{ matchId: string; status: 'queued' | 'skipped' | 'error'; reason?: string; pendingTradeId?: string }> = [];

  for (const m of matches) {
    const criteria = criteriaMap.get(m.criteria_id);
    if (!criteria || !criteria.active) {
      processed.push({ matchId: m.id, status: 'skipped', reason: 'criteria inactive or missing' });
      continue;
    }
    if (!criteria.wallet_address) {
      processed.push({ matchId: m.id, status: 'skipped', reason: 'no wallet configured' });
      continue;
    }

    if (dryRun) {
      processed.push({ matchId: m.id, status: 'queued', reason: 'dry-run' });
      continue;
    }

    // Insert into pending_trades. The separate /api/cron/pending-trades-
    // cleanup + per-trade prep/execute routes pick it up from here.
    const { data: pending, error: insErr } = await supabase
      .from('pending_trades')
      .insert({
        user_id: criteria.user_id,
        wallet_address: criteria.wallet_address,
        chain: m.matched_chain,
        token_in: 'USDC',  // sniper always funds from USDC; tokenResolver upgrades to address
        token_out: m.matched_token_address,
        amount_in_usd: criteria.amount_usd,
        slippage_bps: criteria.slippage_bps ?? 100,
        source: 'sniper',
        source_id: m.id,
        status: 'queued',
      })
      .select('id')
      .single();

    if (insErr || !pending) {
      processed.push({ matchId: m.id, status: 'error', reason: insErr?.message ?? 'insert failed' });
      continue;
    }

    // Backlink so we don't pick this match up again next tick.
    await supabase
      .from('sniper_match_events')
      .update({ pending_trade_id: pending.id })
      .eq('id', m.id);

    processed.push({ matchId: m.id, status: 'queued', pendingTradeId: pending.id });
  }

  const durationMs = Date.now() - startedAt;
  await logCronExecution(
    'sniper-auto-execute',
    processed.filter((p) => p.status === 'error').length === processed.length && processed.length > 0 ? 'failed' : 'success',
    durationMs,
    undefined,
    processed.filter((p) => p.status === 'queued').length,
  );

  return cronResponse('sniper-auto-execute', startedAt, {
    pending: count,
    processed: processed.length,
    queued: processed.filter((p) => p.status === 'queued').length,
    skipped: processed.filter((p) => p.status === 'skipped').length,
    errors: processed.filter((p) => p.status === 'error').length,
    dryRun,
    sample: processed.slice(0, 5),
  });
}
