import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron dispatcher — fans one scheduled invocation out to many cron handlers.
 *
 * WHY: Vercel caps the number of cron *jobs* per plan (Hobby 2, Pro 40). The
 * platform has 53 individual crons, which exceeds the Pro ceiling, so Vercel
 * stops scheduling them entirely. Instead of 53 vercel.json entries we register
 * 5 dispatcher entries (one per cadence group); each dispatcher self-calls the
 * real /api/cron/<name> handlers with the CRON_SECRET. Every handler already
 * short-circuits in <100ms when its feature is idle (cronHasWork / inline count
 * guards), so a dispatcher tick is cheap on an empty platform.
 *
 * The handlers are unchanged — only the *invoker* moved from Vercel directly to
 * this dispatcher. CRONS_PAUSED still works (checked here AND in each handler).
 */

const GROUPS: Record<string, string[]> = {
  // Every ~2 minutes — the demand-gated monitors (all exit instantly at 0 rows).
  frequent: [
    'sniper-monitor', 'sniper-auto-execute', 'sniper-autosell', 'sniper-enrich-security',
    'copy-trade-monitor', 'alert-monitor', 'limit-order-monitor', 'stop-loss-monitor',
    'publish-scheduled-research', 'feed-alert-monitor', 'whale-alert-dispatcher',
  ],
  // Every ~30 minutes.
  'half-hourly': [
    'whale-activity-poll', 'whale-activity-price', 'dca-executor', 'pending-trades-cleanup',
    'receipt-reconciliation', 'notification-retry', 'telegram-retry-failures',
    'pumpfun-velocity-poll', 'cult-resolve-proposals', 'cult-ape-resolve', 'health-watch',
  ],
  // Hourly.
  hourly: [
    'price-cache-refresh', 'market-stats-snapshot', 'watchlist-refresh',
    'token-popularity-aggregator', 'cult-signal-feed', 'smart-money-convergence',
  ],
  // Every 6 hours.
  'six-hourly': [
    'cluster-analysis', 'security-monitor', 'notification-digest', 'telegram-heartbeat',
    'biz-mention-scrape', 'funding-rates-snapshot', 'reputation-feedback',
    'whale-score-populator', 'whale-backfill-pnl', 'cult-refresh-treasury',
    'cult-conviction-score', 'cult-offering-draw',
  ],
  // Once daily (03:00 UTC).
  daily: [
    'daily-digest', 'expired-nonces-cleanup', 'stale-cache-cleanup', 'login-activity-prune',
    'vtx-usage-reset', 'recompute-reputation', 'first-buyer-performance',
    'insider-wallet-detector', 'sybil-clusters', 'dune-refresh', 'whale-logo-backfill',
    'cult-generate-daily-seal', 'cult-verify-membership', 'naka-cult-resolver', 'cult-ape-open',
  ],
};

const CONCURRENCY = 4;

export async function GET(req: NextRequest, ctx: { params: Promise<{ group: string }> }) {
  // CRONS_PAUSED + CRON_SECRET auth (same guard every cron uses).
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const { group } = await ctx.params;
  const paths = GROUPS[group];
  if (!paths) return NextResponse.json({ error: 'unknown_group', group }, { status: 404 });

  const secret = process.env.CRON_SECRET ?? '';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? process.env.VERCEL_URL ?? '';
  const base = `${proto}://${host}`;
  const startedAt = Date.now();
  const results: Record<string, number | string> = {};

  // Fan out with bounded concurrency so a busy tick can't open 50 sockets at
  // once, and the dispatcher stays well within maxDuration.
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (name) => {
        try {
          const r = await fetch(`${base}/api/cron/${name}`, {
            headers: { authorization: `Bearer ${secret}` },
            signal: AbortSignal.timeout(60_000),
          });
          results[name] = r.status;
        } catch (err) {
          results[name] = err instanceof Error ? err.name : 'error';
          Sentry.captureException(err, { tags: { cron: 'dispatch', group, target: name } });
        }
      }),
    );
  }

  // Self-log every dispatch tick to cron_execution_log. This is the diagnostic
  // that makes the scheduler observable from the DB alone: the moment Vercel's
  // scheduler invokes a dispatcher a `dispatch-<group>` row appears here. If the
  // row is present but the downstream handler rows are not, the scheduler IS
  // firing and the fault is downstream (e.g. CRON_SECRET mismatch → handler
  // 401s); if no dispatch row ever appears, the scheduler itself is not running
  // (plan/limit/deploy). Without this, both failure modes looked identical
  // (an empty log), which is how the 43-day outage stayed invisible.
  const durationMs = Date.now() - startedAt;
  const ok2xx = Object.values(results).filter((s) => typeof s === 'number' && s >= 200 && s < 300).length;
  const failed = paths.length - ok2xx;
  const errorSummary = failed > 0
    ? Object.entries(results).filter(([, s]) => !(typeof s === 'number' && s >= 200 && s < 300)).map(([n, s]) => `${n}:${s}`).join(',')
    : undefined;
  await logCronExecution(`dispatch-${group}`, failed > 0 ? 'failed' : 'success', durationMs, errorSummary, ok2xx);

  return NextResponse.json({
    ok: true,
    group,
    dispatched: paths.length,
    succeeded: ok2xx,
    durationMs,
    results,
  });
}
