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
import { usdcForChain } from '@/lib/trading/usdc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  // ADMIN_MIGRATION_SECRET override removed — scoped to DB schema work only.
  // Real-money execution must run under CRON_SECRET. Ad-hoc manual triggering
  // belongs on a dedicated admin endpoint with proper RBAC, not a header
  // bypass on a money-moving cron.
  if (!auth.ok) return auth.response!;

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

  // Honor the admin platform kill switch — don't queue new buys while disabled.
  // Fail CLOSED: if the state can't be read (error or missing row), block,
  // matching the manual /api/sniper/execute safety posture.
  const { data: killState, error: killErr } = await supabase
    .from('platform_sniper_state')
    .select('enabled')
    .eq('id', 1)
    .single();
  if (killErr || !killState || killState.enabled === false) {
    return cronResponse('sniper-auto-execute', startedAt, { pending: count, killed: true, reason: killErr ? 'kill-state unreadable (fail-closed)' : (!killState ? 'kill-state missing (fail-closed)' : 'admin disabled') });
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
  // v2 schema: amount_per_snipe_usd / max_slippage_bps / wallet_addresses[] /
  // enabled+paused (replaced single `active`). The pre-v2 column names were
  // returning NULL here, which meant every auto-snipe got $0 and 100bps
  // default slippage instead of the user's configured values.
  const criteriaIds = Array.from(new Set(matches.map((m) => m.criteria_id)));
  const { data: criteriaRows } = await supabase
    .from('sniper_criteria')
    .select(
      'id, amount_per_snipe_usd, max_slippage_bps, wallet_addresses, wallet_source, enabled, paused, user_id',
    )
    .in('id', criteriaIds);
  const criteriaMap = new Map((criteriaRows ?? []).map((c) => [c.id, c]));

  const processed: Array<{ matchId: string; status: 'queued' | 'skipped' | 'error'; reason?: string; pendingTradeId?: string }> = [];

  for (const m of matches) {
    const criteria = criteriaMap.get(m.criteria_id) as
      | {
          id: string;
          amount_per_snipe_usd: number | null;
          max_slippage_bps: number | null;
          wallet_addresses: string[] | null;
          wallet_source: string | null;
          enabled: boolean | null;
          paused: boolean | null;
          user_id: string;
        }
      | undefined;
    if (!criteria || criteria.enabled === false || criteria.paused === true) {
      processed.push({ matchId: m.id, status: 'skipped', reason: 'criteria inactive or missing' });
      continue;
    }
    const walletAddress = (criteria.wallet_addresses ?? [])[0] ?? null;
    if (!walletAddress) {
      processed.push({ matchId: m.id, status: 'skipped', reason: 'no wallet configured' });
      continue;
    }
    if (!criteria.amount_per_snipe_usd || criteria.amount_per_snipe_usd <= 0) {
      processed.push({ matchId: m.id, status: 'skipped', reason: 'no snipe amount configured' });
      continue;
    }

    // Fund snipes from USDC on the matched chain. The literal 'USDC' string is
    // not an address and breaks the aggregator/GoPlus downstream.
    const usdcAddress = usdcForChain(m.matched_chain);
    if (!usdcAddress) {
      processed.push({ matchId: m.id, status: 'skipped', reason: `no USDC address for chain ${m.matched_chain}` });
      continue;
    }

    if (dryRun) {
      processed.push({ matchId: m.id, status: 'queued', reason: 'dry-run' });
      continue;
    }

    // 1) Create the OPEN position up-front (status 'pending'). The autosell
    //    engine reads confirmed positions; confirm() promotes this row to
    //    'confirmed' with the real entry price + tokens once the buy is signed.
    const { data: execRow, error: execErr } = await supabase
      .from('sniper_executions')
      .insert({
        user_id: criteria.user_id,
        criteria_id: criteria.id,
        token_address: m.matched_token_address,
        chain: m.matched_chain,
        wallet_address: walletAddress,
        buy_amount_usd: criteria.amount_per_snipe_usd,
        slippage_bps: criteria.max_slippage_bps ?? 200,
        status: 'pending',
      })
      .select('id')
      .single();
    if (execErr || !execRow) {
      processed.push({ matchId: m.id, status: 'error', reason: execErr?.message ?? 'execution insert failed' });
      continue;
    }

    // 2) Queue the buy on pending_trades with the VERIFIED live schema
    //    (from_token_address/to_token_address/amount_in base units/route_data/
    //    source_order_table). USDC is 6-decimal, so base units = usd * 1e6.
    const amountInBaseUnits = String(Math.round(criteria.amount_per_snipe_usd * 1e6));
    // Map the criteria wallet vocabulary (metamask/phantom/builtin) to the
    // relayer/pending_trades vocabulary (external_evm/external_solana/builtin).
    // The pending_trades CHECK only allows the latter set.
    const walletSource = criteria.wallet_source === 'phantom'
      ? 'external_solana'
      : criteria.wallet_source === 'builtin'
        ? 'builtin'
        : 'external_evm';
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const { data: pending, error: insErr } = await supabase
      .from('pending_trades')
      .insert({
        user_id: criteria.user_id,
        chain: m.matched_chain,
        wallet_source: walletSource,
        from_token_address: usdcAddress,
        from_token_symbol: 'USDC',
        to_token_address: m.matched_token_address,
        amount_in: amountInBaseUnits,
        slippage_bps: criteria.max_slippage_bps ?? 200,
        source_reason: 'sniper_buy',
        source_order_id: execRow.id,
        source_order_table: 'sniper_executions',
        status: 'pending',
        route_data: {},
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insErr || !pending) {
      // Roll back the orphaned position so it doesn't sit forever as 'pending'.
      await supabase.from('sniper_executions').delete().eq('id', execRow.id);
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
