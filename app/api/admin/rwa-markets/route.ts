import 'server-only';
import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

/**
 * RWA / markets board health.
 *
 * GET /api/admin/rwa-markets
 *
 * The public board at /api/markets/rwa is powered by Twelve Data and returns an
 * honest { available:false } when TWELVE_DATA_API_KEY is unset. This endpoint
 * reports the same configuration signal (never a fabricated price) plus, when a
 * key is present, a lightweight live probe of the internal board route so the
 * admin can see at a glance whether real quotes are flowing.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  const configured = Boolean(process.env.TWELVE_DATA_API_KEY);
  const finnhubConfigured = Boolean(process.env.FINNHUB_API_KEY);

  let live = false;
  let rowCount = 0;
  let reason: string | null = configured ? null : 'market data key not set';
  let asOf: string | null = null;

  if (configured) {
    try {
      const origin = new URL(request.url).origin;
      const res = await fetch(`${origin}/api/markets/rwa`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.available) {
          live = true;
          rowCount = Array.isArray(json.rows) ? json.rows.length : 0;
          asOf = typeof json.asOf === 'string' ? json.asOf : null;
        } else {
          reason = typeof json?.reason === 'string' ? json.reason : 'board unavailable';
        }
      } else {
        reason = `board responded ${res.status}`;
      }
    } catch {
      reason = 'board probe failed';
    }
  }

  return NextResponse.json({
    provider: 'Twelve Data',
    configured,
    finnhubConfigured,
    live,
    rowCount,
    asOf,
    reason,
  });
}
