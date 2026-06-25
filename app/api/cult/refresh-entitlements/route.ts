import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getUserEvmAddresses } from '@/lib/cult/walletAddresses';
import { applyWalletEntitlements } from '@/lib/cult/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cult/refresh-entitlements
 *
 * On-demand re-check of the authenticated user's on-chain entitlements across
 * ALL their linked EVM wallets (wallet_identities + user_wallets_v2). Otherwise
 * entitlements are only applied at wallet sign-in, so a user who acquires a
 * Founder Pass / NIPPO / crosses the $NAKA threshold AFTER signing in — or who
 * uses email/password with a linked wallet — would never be re-evaluated until
 * the daily resolver cron runs. This lets the UI reconcile immediately.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const addresses = await getUserEvmAddresses(user.id);
    if (addresses.length === 0) {
      return NextResponse.json({ cult: false, cultSource: null, max: false, addresses: 0 });
    }
    const ent = await applyWalletEntitlements(user.id, addresses);
    return NextResponse.json({ ...ent, addresses: addresses.length });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'cult/refresh-entitlements' } });
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
