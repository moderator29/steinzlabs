import 'server-only';
import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only snapshot of the relayer subsystem. Rendered by
 * /components/admin/RelayerHealthCard. Aggregates counts from
 * pending_trades + source-order tables + cron_execution_log so on-call
 * can see issues without running SQL.
 */

interface StatusCount {
  status: string;
  count: number;
}

interface CronStat {
  cron_name: string;
  runs_24h: number;
  failures_24h: number;
  last_run: string | null;
}

interface RecentFailure {
  table: string;
  id: string;
  revert_reason: string | null;
  at: string;
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  async function countByStatus(table: string): Promise<StatusCount[]> {
    const { data } = await admin.from(table).select('status');
    const rows = (data ?? []) as Array<{ status: string }>;
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return Array.from(m.entries()).map(([status, count]) => ({ status, count }));
  }

  const [pending, limitOrders, dcaBots, stopLoss, copyTrades] = await Promise.all([
    countByStatus('pending_trades'),
    countByStatus('limit_orders'),
    countByStatus('dca_bots'),
    countByStatus('stop_loss_orders'),
    countByStatus('user_copy_trades'),
  ]);

  // Cron execution stats from cron_execution_log
  const relevantCrons = [
    'limit-order-monitor',
    'dca-executor',
    'stop-loss-monitor',
    'copy-trade-monitor',
    'pending-trades-cleanup',
    'receipt-reconciliation',
  ];
  const cronStats: CronStat[] = [];
  for (const c of relevantCrons) {
    const { data: runs } = await admin
      .from('cron_execution_log')
      .select('status, started_at')
      .eq('cron_name', c)
      .gte('started_at', since);
    const total = runs?.length ?? 0;
    const failures = (runs ?? []).filter((r) => r.status !== 'success').length;
    const latest = runs?.[runs.length - 1]?.started_at ?? null;
    cronStats.push({ cron_name: c, runs_24h: total, failures_24h: failures, last_run: latest });
  }

  // Reconciliation backlog
  const [
    { count: limitBacklog },
    { count: dcaBacklog },
    { count: slBacklog },
    { count: ctBacklog },
  ] = await Promise.all([
    admin
      .from('limit_orders')
      .select('id', { count: 'exact', head: true })
      .not('executed_tx_hash', 'is', null)
      .is('receipt_reconciled_at', null),
    admin
      .from('dca_executions')
      .select('id', { count: 'exact', head: true })
      .not('tx_hash', 'is', null)
      .is('receipt_reconciled_at', null),
    admin
      .from('stop_loss_orders')
      .select('id', { count: 'exact', head: true })
      .not('triggered_tx_hash', 'is', null)
      .is('receipt_reconciled_at', null),
    admin
      .from('user_copy_trades')
      .select('id', { count: 'exact', head: true })
      .not('copied_tx_hash', 'is', null)
      .is('receipt_reconciled_at', null),
  ]);

  // Recent reverts (last 24h)
  const failures: RecentFailure[] = [];
  for (const table of ['limit_orders', 'stop_loss_orders', 'dca_executions', 'user_copy_trades']) {
    const { data } = await admin
      .from(table)
      .select('id,revert_reason,receipt_reconciled_at')
      .eq('tx_reverted', true)
      .gte('receipt_reconciled_at', since)
      .order('receipt_reconciled_at', { ascending: false })
      .limit(5);
    for (const r of (data ?? []) as Array<{
      id: string;
      revert_reason: string | null;
      receipt_reconciled_at: string;
    }>) {
      failures.push({
        table,
        id: r.id,
        revert_reason: r.revert_reason,
        at: r.receipt_reconciled_at,
      });
    }
  }
  failures.sort((a, b) => b.at.localeCompare(a.at));

  return NextResponse.json({
    pending_trades: pending,
    limit_orders: limitOrders,
    dca_bots: dcaBots,
    stop_loss_orders: stopLoss,
    user_copy_trades: copyTrades,
    cron_stats: cronStats,
    reconciliation_backlog: {
      limit_orders: limitBacklog ?? 0,
      dca_executions: dcaBacklog ?? 0,
      stop_loss_orders: slBacklog ?? 0,
      user_copy_trades: ctBacklog ?? 0,
    },
    recent_reverts: failures.slice(0, 10),
    generated_at: new Date().toISOString(),
  });
}
