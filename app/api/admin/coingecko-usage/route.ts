import 'server-only';
import { NextResponse } from 'next/server';
import { getCoingeckoUsage } from '@/lib/services/coingecko';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

/**
 * Admin: surface the in-memory CoinGecko call counter so we can see what's
 * burning credits without logging into CoinGecko's dashboard. Resets on every
 * cold start — so the numbers are "since last deploy / lambda warm-up," not
 * monthly totals. For monthly totals, open https://www.coingecko.com/en/developers/dashboard.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  const usage = getCoingeckoUsage();
  return NextResponse.json({
    ...usage,
    note: 'In-memory counter. Resets on each lambda cold start. Monthly plan usage is on CoinGecko dashboard.',
  });
}
