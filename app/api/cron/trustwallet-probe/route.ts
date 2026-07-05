import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { twGatewayConfigured, twProbe } from '@/lib/services/trustwallet';

/**
 * Server-side Trust Wallet gateway probe. Runs on the cron schedule and writes
 * the live result (status + response shapes) to trustwallet_probe_log so the
 * integration can be validated straight from the database — no manual browser
 * step for the owner. Self-limiting: once a probe with any 2xx is recorded it
 * stops re-probing (nothing left to validate).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAME = 'trustwallet-probe';
// Round 2 discovery — the confirmed endpoint is /v1/search/assets ({docs,total},
// price usually null but verified market cap present). These probe for the
// dedicated PRICE and SECURITY endpoints (USDT on Ethereum as the sample token,
// asset_id c60_t0xdAC17F958D2ee523a2206206994597C13D831ec7).
const USDT = 'c60_t0xdAC17F958D2ee523a2206206994597C13D831ec7';
const ENDPOINTS = [
  { path: '/v1/search/assets', query: { query: 'ethereum' } },
  { path: '/v1/assets/popular' },
  { path: `/v1/assets/${USDT}` },
  { path: '/v1/assets', query: { asset_ids: USDT } },
  { path: '/v1/markets', query: { asset_ids: USDT } },
  { path: `/v1/assets/${USDT}/market` },
  { path: `/v1/security/${USDT}` },
  { path: `/v1/assets/${USDT}/security` },
];

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  try {
    const admin = getSupabaseAdmin();

    // Skip once we already have a good probe on file.
    const { data: prev } = await admin.from('trustwallet_probe_log').select('any_ok').eq('id', 1).maybeSingle<{ any_ok: boolean }>();
    if (prev?.any_ok) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, 'already-validated', 0);
      return NextResponse.json({ ok: true, skipped: 'already-validated' });
    }

    const configured = twGatewayConfigured();
    const results = configured ? await twProbe(ENDPOINTS) : [];
    const anyOk = results.some((r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300);

    await admin.from('trustwallet_probe_log').upsert({
      id: 1,
      configured,
      agent_present: !!process.env.TWAK_AGENT_ID,
      any_ok: anyOk,
      results,
      ran_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    await logCronExecution(NAME, 'success', Date.now() - startedAt, configured ? undefined : 'not-configured', results.length);
    return NextResponse.json({ ok: true, configured, anyOk, endpoints: results.length });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
