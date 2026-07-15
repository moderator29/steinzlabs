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
    'sniper-feed-ingest', 'sniper-feed-enrich-security', 'mm-engine',
    'sniper-monitor', 'sniper-auto-execute', 'sniper-autosell', 'sniper-enrich-security',
    'copy-trade-monitor', 'alert-monitor', 'limit-order-monitor', 'stop-loss-monitor',
    // Confirms Wire gifts on-chain (pending -> confirmed/failed). Exits instantly
    // when no gifts are pending.
    'gift-confirm',
    // Naka Predict "Breaking Live": keep short-horizon markets open, and settle
    // expired ones against the real price. Both exit fast when there is no work.
    'predict-generate', 'predict-resolve',
    'publish-scheduled-research', 'feed-alert-monitor', 'whale-alert-dispatcher',
    // One-off self-validating Trust Wallet gateway probe — writes the live
    // result to trustwallet_probe_log then self-stops once a 2xx is seen.
    'trustwallet-probe',
  ],
  // Every ~30 minutes.
  'half-hourly': [
    'whale-activity-poll', 'whale-activity-price', 'bitquery-activity-poll', 'dca-executor', 'pending-trades-cleanup',
    'receipt-reconciliation', 'notification-retry', 'telegram-retry-failures', 'stock-alerts', 'coin-alerts',
    'pumpfun-velocity-poll', 'cult-resolve-proposals', 'cult-ape-resolve', 'health-watch',
    // Free MEV fallback (ZeroMEV, Ethereum) — scans recent blocks into a rolling
    // 30d per-victim aggregate for MEV Radar when Dune's MEV surface is empty.
    'mev-backfill-zeromev',
    // Crypto tier payments — watches the treasury for incoming USDC and
    // grants the tier on match. Exits instantly when no payments are pending.
    'payment-verify',
    // Samples live network gas price per chain into gas_samples so Smart Gas
    // Timing can learn cheap-hour patterns. Skips instantly with no Alchemy key.
    'gas-sample',
    // Autonomous VTX Sentinel watches — evaluate each active sentinel against
    // live data and notify on real change. Exits instantly with no sentinels.
    'vtx-sentinel',
  ],
  // Hourly.
  hourly: [
    'price-cache-refresh', 'market-stats-snapshot', 'watchlist-refresh',
    'token-popularity-aggregator', 'cult-signal-feed', 'smart-money-convergence',
    // Whale discovery pulled to hourly for the directory fill-up: 8 chains via
    // Bitquery, top ~500 active traders each, ranked by real 7d DEX volume. The
    // sliding 7-day window churns the discoverable set so successive runs keep
    // adding NEW real whales. Dial back to six-hourly once the roster saturates.
    'bitquery-traders',
  ],
  // Every 6 hours.
  'six-hourly': [
    'cluster-analysis', 'security-monitor', 'notification-digest', 'telegram-heartbeat',
    'biz-mention-scrape', 'funding-rates-snapshot', 'reputation-feedback',
    'whale-score-populator', 'whale-backfill-pnl', 'whale-winrate', 'whale-discovery', 'market-pulse-warm', 'cult-refresh-treasury',
    'cult-conviction-score', 'cult-offering-draw',
  ],
  // Every 12 hours (00:00 + 12:00 UTC) — the research brief publishes two
  // editions a day (Morning / Evening).
  'twice-daily': [
    'research-daily-brief',
    // Twice-daily crypto news roundup to users who opted in (notification_settings
    // .news_alerts). Exits instantly when nobody has opted in.
    'news-digest',
    // Clean news-to-Telegram drop for users who opted in (telegram_news_drop).
    // Idempotent + quiet-hours aware; exits instantly when nobody has opted in.
    'news-telegram',
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
  // Vercel Deployment Protection (Vercel Authentication / password) challenges
  // every request to the deployment URL — INCLUDING this dispatcher's own
  // server-to-server fetches to /api/cron/<name>. The scheduler's invocation of
  // the dispatcher is exempt, but our fan-out fetches are not, so without a
  // bypass they receive a 200 HTML auth page and the real handler never runs —
  // which is exactly how every handler sat frozen while the dispatcher logged
  // "success". Sending the automation bypass secret lets the sub-requests
  // through. Harmless no-op when protection is disabled / the secret is unset.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '';
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
          const headers: Record<string, string> = { authorization: `Bearer ${secret}` };
          if (bypass) {
            headers['x-vercel-protection-bypass'] = bypass;
            headers['x-vercel-set-bypass-cookie'] = 'false';
          }
          const r = await fetch(`${base}/api/cron/${name}`, {
            headers,
            signal: AbortSignal.timeout(60_000),
          });
          // A real cron handler always replies JSON. If a 2xx comes back as
          // HTML it's the Deployment-Protection wall, not the handler — record
          // it as a distinct failure marker so it counts as failed and surfaces
          // in the error summary instead of masquerading as success.
          const contentType = r.headers.get('content-type') ?? '';
          results[name] = r.ok && !contentType.includes('application/json')
            ? `blocked-${r.status}`
            : r.status;
        } catch (err) {
          const errName = err instanceof Error ? err.name : 'error';
          results[name] = errName;
          // A per-handler fetch timeout/abort is already recorded in `results`
          // and rolled into the dispatch-<group> failed summary + cron_execution_log,
          // so it stays observable. Don't ALSO page Sentry for it — an
          // occasionally-slow non-critical handler (e.g. whale-activity-poll)
          // overrunning the 60s budget is expected operational noise, not a bug.
          // Real handler exceptions (non-timeout) still surface here.
          const isTimeout = errName === 'TimeoutError' || errName === 'AbortError';
          if (!isTimeout) {
            Sentry.captureException(err, { tags: { cron: 'dispatch', group, target: name } });
          }
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
