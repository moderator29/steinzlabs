import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * RUM (Real User Monitoring) ingestion. Receives Web Vitals + custom
 * timing marks from the client and forwards to the structured log
 * stream. Vercel + external collectors can ingest the JSON line and
 * roll percentiles in a separate dashboard. Edge runtime so the
 * report does not contend with main-route serverless cold starts.
 *
 * Body shape is the standard web-vitals onCLS/onINP/onLCP payload
 * (name, value, id, rating, navigationType). Anything past the
 * schema is silently dropped so a buggy reporter version can't
 * poison the log.
 */

const VITAL = z.object({
  name: z.enum(['CLS', 'FCP', 'INP', 'LCP', 'TTFB', 'FID']),
  value: z.number().finite(),
  id: z.string().max(64),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  navigationType: z.string().max(32).optional(),
});

const BODY = z.object({
  url: z.string().max(2048).optional(),
  vitals: z.array(VITAL).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }
    const route = parsed.data.url
      ? new URL(parsed.data.url).pathname
      : 'unknown';
    for (const v of parsed.data.vitals) {
      // Single-line JSON so Vercel + log collectors can ingest without
      // regex parsing. Once feat/structured-logger-lib lands this should
      // swap to log.child({ rum: true, route }).info('web-vital', ...).
      const line = JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        msg: 'web-vital',
        rum: true,
        route,
        name: v.name,
        value: v.value,
        rating: v.rating,
        id: v.id,
      });
      // eslint-disable-next-line no-console
      console.log(line);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    // Body unparseable / malformed JSON. Fail closed silently — RUM is
    // observability, not correctness.
    return new NextResponse(null, { status: 204 });
  }
}
