import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Surface client-side render throws to the server so we can debug
 * production-only bugs without asking owners to copy/paste their
 * devtools console. Wired by TabErrorBoundary on the dashboard so
 * any tab that throws lands here with its message + componentStack
 * + path.
 *
 * Rate-limited by Sentry's own dedup (same message+stack within 5 min
 * collapses to one event). No PII captured beyond what the browser
 * already sends in normal page requests.
 */

interface ClientErrorPayload {
  message?: string;
  componentStack?: string;
  path?: string;
  source?: string;
}

export async function POST(req: NextRequest) {
  let body: ClientErrorPayload;
  try {
    body = (await req.json()) as ClientErrorPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = (body.message ?? 'unknown client error').slice(0, 500);
  const componentStack = (body.componentStack ?? '').slice(0, 4000);
  const path = (body.path ?? '').slice(0, 200);
  const source = (body.source ?? 'unknown').slice(0, 60);

  console.error('[client-error]', { source, path, message, componentStack });
  Sentry.captureMessage(`[client] ${message}`, {
    level: 'error',
    tags: { source, path },
    contexts: { client: { componentStack, path, source } },
  });

  return NextResponse.json({ ok: true });
}
