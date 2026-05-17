import * as Sentry from '@sentry/nextjs';

/**
 * Per-route trace sampling — the flat 0.1 prod rate was costing 40-60%
 * of the Sentry bill on hot polling routes (whale-activity, market
 * stats, price cache) that we don't need fine-grained traces for.
 *
 * Strategy:
 *   • critical user flows                          1.0 / 0.5
 *     (trade execute, wallet auth, security gate)
 *   • interesting business flows                   0.2
 *     (proof view, VTX chat, sniper enrich)
 *   • noisy background polls + health checks      0.01 / 0
 *   • everything else                              0.1 (parent rate)
 */
function tracesSampler(context: { name?: string; location?: { pathname?: string } }): number {
  const path = context.location?.pathname ?? context.name ?? '';
  // Drop health + ping noise outright.
  if (path.startsWith('/api/health') || path === '/api/rum' || path.startsWith('/api/cron/')) {
    return 0.01;
  }
  // Trade execution is gold.
  if (
    path.startsWith('/api/market/trade/') ||
    path.startsWith('/api/sniper/execute') ||
    path.startsWith('/api/copy-trading/') ||
    path.startsWith('/api/auth/')
  ) {
    return process.env.NODE_ENV === 'production' ? 0.5 : 1.0;
  }
  // Interesting but not critical.
  if (
    path.startsWith('/api/vtx-ai') ||
    path.startsWith('/api/bubble-map') ||
    path.startsWith('/api/security/') ||
    path.startsWith('/api/engagement')
  ) {
    return process.env.NODE_ENV === 'production' ? 0.2 : 1.0;
  }
  // High-volume polling — keep sampling alive but minimal.
  if (
    path.startsWith('/api/portfolio') ||
    path.startsWith('/api/market/stats') ||
    path.startsWith('/api/whale/activity')
  ) {
    return process.env.NODE_ENV === 'production' ? 0.02 : 0.5;
  }
  return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampler,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],
  beforeSend(event) {
    if (event.request?.cookies) {
      event.request.cookies = {};
    }
    return event;
  },
});
