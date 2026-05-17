import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

/**
 * guardRoute — a one-call wrapper that enforces authentication + rate
 * limiting + (optional) CSRF on a state-changing API route. Audit
 * Agent 16 found copy-trading/execute, wallet/send, alerts POST,
 * support POST, user/delete had no rate limit; Agent 15 found CSRF
 * tokens defined but never verified on cookie-auth state-changing
 * routes. This wrapper closes both gaps in one consistent surface.
 *
 * Usage:
 *   export async function POST(req: NextRequest) {
 *     const guard = await guardRoute(req, { rate: 'high', csrf: true });
 *     if (!guard.ok) return guard.response;
 *     const user = guard.user;
 *     ...
 *   }
 *
 * Rate-limit buckets (in-memory token bucket; per-instance for v1):
 *   - 'high'   30 per minute  (sniper / copy-trade execute)
 *   - 'med'    60 per minute  (alerts / rules / support)
 *   - 'low'   120 per minute  (search / list endpoints)
 *
 * Backlog: swap in-memory bucket for Upstash Redis (lib/rateLimit/
 * rateLimit.ts) once traffic warrants it.
 */

export interface GuardOptions {
  rate: 'high' | 'med' | 'low';
  csrf?: boolean;
  /** When true, anonymous requests are allowed but still rate-limited by IP. */
  allowAnon?: boolean;
}

interface Bucket { tokens: number; refilledAt: number }
const buckets = new Map<string, Bucket>();

const RATE_CFG: Record<GuardOptions['rate'], { capacity: number; refillPerSec: number }> = {
  high: { capacity: 30,  refillPerSec: 30  / 60 },
  med:  { capacity: 60,  refillPerSec: 60  / 60 },
  low:  { capacity: 120, refillPerSec: 120 / 60 },
};

function takeToken(key: string, cfg: { capacity: number; refillPerSec: number }): boolean {
  const now = Date.now() / 1000;
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: cfg.capacity - 1, refilledAt: now };
    buckets.set(key, b);
    return true;
  }
  const elapsed = now - b.refilledAt;
  b.tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillPerSec);
  b.refilledAt = now;
  if (b.tokens >= 1) { b.tokens -= 1; return true; }
  return false;
}

export type GuardResult =
  | { ok: true; user: { id: string; email: string } | null }
  | { ok: false; response: NextResponse };

export async function guardRoute(req: NextRequest, opts: GuardOptions): Promise<GuardResult> {
  const user = await getAuthenticatedUser(req);
  if (!user && !opts.allowAnon) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';
  const ip = ipHeader.split(',')[0]?.trim() || 'unknown';
  const identity = user?.id ?? `ip:${ip}`;
  const key = `${opts.rate}:${identity}`;
  if (!takeToken(key, RATE_CFG[opts.rate])) {
    return { ok: false, response: NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 }) };
  }

  if (opts.csrf) {
    // Double-submit cookie check: a `naka_csrf` cookie must be present
    // and equal the `x-csrf-token` request header. Routes that don't
    // opt-in skip this entirely. New surfaces should opt in.
    const cookieToken = req.cookies.get('naka_csrf')?.value;
    const headerToken = req.headers.get('x-csrf-token');
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return { ok: false, response: NextResponse.json({ error: 'CSRF token missing or mismatched' }, { status: 403 }) };
    }
  }

  return { ok: true, user };
}
