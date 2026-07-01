import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { computeWalletHealth } from '@/lib/security/walletHealth';
import { cacheGet, cacheSet } from '@/lib/cache/redis';
import { takeToken } from '@/lib/cache/upstash-rate-limit';
import { normalizeAddress } from '@/lib/utils/addressNormalize';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/security/wallet-health?address=0x...&chain=ethereum
 *
 * Webacy-style shareable wallet health score for ANY looked-up wallet (not just
 * the authenticated user). Transparent 0..100 composite computed in
 * lib/security/walletHealth.ts from REAL signals: open risky approvals, honeypot
 * / tax exposure across holdings (GoPlus), OFAC sanctions, and wallet age /
 * activity. Honest partial score when a source is unavailable.
 *
 * Results are cached in Redis (10 min) keyed by (address, chain) so a shared
 * card link is cheap to serve, and — best-effort — snapshotted to
 * wallet_health_scores for a public, cross-instance record (degrades quietly
 * when the migration isn't applied).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESULT_TTL_S = 10 * 60;

const schema = z.object({
  address: z.string().trim().min(1).max(64),
  chain: z.string().trim().min(1).max(24).default('ethereum'),
});

export async function GET(req: NextRequest) {
  const parsed = schema.safeParse({
    address: req.nextUrl.searchParams.get('address') ?? '',
    chain: req.nextUrl.searchParams.get('chain') ?? 'ethereum',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'address query param required (chain optional, defaults to ethereum)' },
      { status: 400 },
    );
  }
  const { address, chain } = parsed.data;

  const norm = normalizeAddress(address, chain);
  const cacheKeyId = `wallet-health:${chain.toLowerCase()}:${norm}`;

  // Serve a fresh cached result if present (keeps shared cards fast and the
  // upstream call budget bounded).
  const cached = await cacheGet<Awaited<ReturnType<typeof computeWalletHealth>>>(cacheKeyId);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  // Basic abuse guard on the expensive compute path (fan-out to Alchemy + GoPlus
  // + Chainalysis). Fail-open when Redis is unset.
  const allowed = await takeToken(`walletHealth:${norm}:${chain.toLowerCase()}`, {
    capacity: 12,
    refillSec: 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limited. Try again shortly.' },
      { status: 429 },
    );
  }

  let result: Awaited<ReturnType<typeof computeWalletHealth>>;
  try {
    result = await computeWalletHealth(address, chain);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Health computation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  void cacheSet(cacheKeyId, result, RESULT_TTL_S);

  // Best-effort public snapshot so the score has a durable, cross-instance
  // record and we can render trend later. Additive table; degrade quietly when
  // the migration hasn't been applied.
  if (result.score !== null) {
    try {
      const admin = getSupabaseAdmin();
      await admin.from('wallet_health_scores').upsert({
        address: norm,
        chain: chain.toLowerCase(),
        score: result.score,
        band: result.band,
        coverage: result.coverage,
        components: result.components,
        signals: result.signals,
        computed_at: result.computedAt,
      }, { onConflict: 'address,chain' });
    } catch { /* wallet_health_scores absent until migration applied */ }
  }

  return NextResponse.json({ ...result, cached: false });
}
