// Next.js instrumentation hook. Replaces the deprecated sentry.server.config.ts
// and sentry.edge.config.ts entry points (Next 15 / @sentry/nextjs 8+).
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }
}

// Required by @sentry/nextjs 8+ — captures uncaught request errors and
// forwards them to Sentry with full request context.
export const onRequestError = Sentry.captureRequestError;
