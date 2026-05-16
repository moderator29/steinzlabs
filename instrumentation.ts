// Next.js instrumentation hook. Replaces the deprecated sentry.server.config.ts
// and sentry.edge.config.ts entry points (Next 15 / @sentry/nextjs 8+).
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from '@sentry/nextjs';

/**
 * Per-route traces sampler. Audit §5.11 estimate: cuts Sentry trace
 * volume 40–60% with no signal loss on the routes that actually
 * matter for debugging.
 *
 * Rules:
 *   • /api/health and /api/rum — heavy traffic, near-zero diagnostic
 *     value. 0.5% sample.
 *   • /api/cron/\\* — runs on schedule, full sample so we always see
 *     a recent run. 100%.
 *   • /api/market/trade/execute, /api/sniper/execute,
 *     /api/copy-trading/\\* — money paths. 100%.
 *   • Everything else — 5% in prod, 100% in dev.
 */
function pickSamplingRate(name: string | undefined): number {
  if (!name) return 0.05;
  if (name.startsWith('/api/health') || name.startsWith('/api/rum')) return 0.005;
  if (name.startsWith('/api/cron/')) return 1;
  if (name.startsWith('/api/market/trade/execute')) return 1;
  if (name.startsWith('/api/sniper/execute')) return 1;
  if (name.startsWith('/api/copy-trading/')) return 1;
  return 0.05;
}

interface SamplingContext {
  name?: string;
  attributes?: Record<string, unknown>;
}

function tracesSampler(ctx: SamplingContext): number {
  if (process.env.NODE_ENV !== 'production') return 1;
  const name = typeof ctx.name === 'string' ? ctx.name : undefined;
  const httpRoute =
    typeof ctx.attributes?.['http.route'] === 'string'
      ? (ctx.attributes['http.route'] as string)
      : undefined;
  return pickSamplingRate(httpRoute ?? name);
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampler,
    });
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampler,
    });
  }
}

// Required by @sentry/nextjs 8+ — captures uncaught request errors and
// forwards them to Sentry with full request context.
export const onRequestError = Sentry.captureRequestError;
