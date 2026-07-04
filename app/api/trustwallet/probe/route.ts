import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { twGatewayConfigured, twProbe } from '@/lib/services/trustwallet';

/**
 * GET /api/trustwallet/probe   (admin only)
 *
 * One-time validation tool for the Trust Wallet Agent Kit gateway. After you set
 * TWAK_ACCESS_ID / TWAK_HMAC_SECRET / TWAK_AGENT_ID and deploy, hit this with the
 * admin secret to confirm auth works and to reveal the live RESPONSE SHAPES of
 * the key endpoints — so the price / security / swap integrations get wired
 * against real data instead of guessed schemas.
 *
 *   curl -H "x-migration-secret: $ADMIN_MIGRATION_SECRET" \
 *        https://nakalabs.xyz/api/trustwallet/probe
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENDPOINTS = [
  { path: '/v1/-/healthy' },
  { path: '/v1/assets/popular' },
  { path: '/v2/market/tickers' },
  { path: '/v1/search/assets', query: { query: 'ethereum' } },
];

export async function GET(req: NextRequest) {
  // Accept the secret via header OR ?secret= query param so it can be run
  // straight from a phone browser (one-time admin validation). Matches either
  // ADMIN_MIGRATION_SECRET or CRON_SECRET — whichever you have set in Vercel.
  const provided = req.headers.get('x-migration-secret')
    || req.nextUrl.searchParams.get('secret')
    || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const ok = (!!process.env.ADMIN_MIGRATION_SECRET && provided === process.env.ADMIN_MIGRATION_SECRET)
    || (!!process.env.CRON_SECRET && provided === process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'unauthorized — append ?secret=<your ADMIN_MIGRATION_SECRET or CRON_SECRET>' }, { status: 403 });

  if (!twGatewayConfigured()) {
    return NextResponse.json({
      configured: false,
      hint: 'Set TWAK_ACCESS_ID, TWAK_HMAC_SECRET (and TWAK_AGENT_ID) in Vercel, then redeploy.',
    });
  }

  const results = await twProbe(ENDPOINTS);
  return NextResponse.json({
    configured: true,
    agentIdPresent: !!process.env.TWAK_AGENT_ID,
    results,
    note: 'Any 200 confirms auth. Paste this output back and the price/security/swap wiring gets finished against the real shapes. A 401/403 on every row means the signed-string order needs a one-line tweak in twGet.',
  });
}
