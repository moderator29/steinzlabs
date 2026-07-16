import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCoin } from '@/lib/coins/coinService';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  fetchAndScoreDeployerHistory,
  resolveDeployer,
  DEPLOYER_CACHE_TTL_SEC,
} from '@/lib/security/deployerHistoryFetcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Compact deployer reputation for a coin. Reuses the existing on-chain
 * deployer-history service (lib/security/deployerHistoryFetcher +
 * scoreDeployerRugHistory) that already backs the Security Panel and the
 * Deployer DNA route. Nothing is reimplemented here: we resolve the coin,
 * hand its token to that service, and fold the result into a small honest
 * summary the coin page can render inline.
 *
 * HONEST: when the chain has no configured source, the creator cannot be
 * resolved, or the on-chain lookup returns nothing, we answer
 * `available:false` with a reason rather than inventing a track record.
 */

type RiskLabel = 'clean' | 'mixed' | 'serial_rugger' | 'unknown';

interface DeployerSummary {
  available: boolean;
  deployer?: string;
  launchCount?: number;
  ruggedCount?: number;
  riskLabel?: RiskLabel;
  summary?: string;
  reason?: string;
}

/** Map the scorer band (or DB cache band) to the compact three-way label. */
function bandToRiskLabel(band: string, rugged: number): RiskLabel {
  if (band === 'serial-rugger') return 'serial_rugger';
  if (band === 'dangerous' || band === 'caution') return 'mixed';
  if (band === 'clean' || band === 'pristine') {
    // A "clean" band with real rugs on record is honestly mixed, not clean.
    return rugged > 0 ? 'mixed' : 'clean';
  }
  return 'unknown';
}

/** Map the scorer tier straight to a band string (mirrors the DNA route). */
function tierToBand(tier: string, totalDeployed: number): string {
  if (tier === 'serial-rugger') return 'serial-rugger';
  if (tier === 'risky') return 'dangerous';
  if (tier === 'caution') return 'caution';
  return totalDeployed <= 1 ? 'pristine' : 'clean';
}

function buildSummary(launchCount: number, ruggedCount: number, label: RiskLabel): string {
  if (launchCount === 0) return 'Deployer resolved, no prior launches found on this chain';
  const coins = `${launchCount} ${launchCount === 1 ? 'coin' : 'coins'}`;
  if (label === 'serial_rugger') return `Serial rugger: launched ${coins}, ${ruggedCount} rugged`;
  if (ruggedCount > 0) return `Deployer launched ${coins}, ${ruggedCount} rugged`;
  return `Deployer launched ${coins}, none rugged so far`;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);
  const lower = chain.toLowerCase();

  // Confirm this is a real, graduated coin before spending an on-chain lookup.
  const coin = await resolveCoin(chain, addr).catch(() => null);
  if (!coin) {
    return NextResponse.json({ available: false, reason: 'Coin not found' } satisfies DeployerSummary);
  }

  const sb = getSupabaseAdmin();
  const freshSince = new Date(Date.now() - DEPLOYER_CACHE_TTL_SEC * 1000).toISOString();

  // Cache serve: on EVM we can resolve the creator cheaply, then reuse the shared
  // 24h deployer_history_cache the Security Panel / DNA routes already populate.
  const known = await resolveDeployer(lower, addr).catch(() => null);
  if (known) {
    const { data: hit } = await sb
      .from('deployer_history_cache')
      .select('deployer_address, band, total_deployed, total_dead')
      .eq('chain', lower)
      .ilike('deployer_address', known)
      .gte('fetched_at', freshSince)
      .maybeSingle<{ deployer_address: string; band: string; total_deployed: number; total_dead: number }>();
    if (hit) {
      const launchCount = hit.total_deployed ?? 0;
      const ruggedCount = hit.total_dead ?? 0;
      const riskLabel = bandToRiskLabel(hit.band, ruggedCount);
      return NextResponse.json({
        available: true,
        deployer: hit.deployer_address,
        launchCount,
        ruggedCount,
        riskLabel,
        summary: buildSummary(launchCount, ruggedCount, riskLabel),
      } satisfies DeployerSummary);
    }
  }

  // Cache miss (or non-EVM chain): run the shared fetch+score, then persist for
  // 24h so the Security Panel and this chip stay consistent.
  const result = await fetchAndScoreDeployerHistory(lower, addr).catch(() => null);
  if (!result) {
    return NextResponse.json({
      available: false,
      reason: lower === 'solana'
        ? 'Deployer history is unavailable for this Solana token'
        : 'No deployer history source configured for this chain, or the on-chain lookup returned nothing',
    } satisfies DeployerSummary);
  }

  const band = tierToBand(result.history.tier, result.history.totalDeployed);
  const launchCount = result.history.totalDeployed;
  const ruggedCount = result.history.totalDead;
  const riskLabel = bandToRiskLabel(band, ruggedCount);

  await sb.from('deployer_history_cache').upsert(
    {
      chain: lower,
      deployer_address: result.deployer,
      trust_score: 100 - result.history.score,
      band,
      total_deployed: result.history.totalDeployed,
      total_dead: result.history.totalDead,
      total_flagged: result.history.totalFlagged,
      fast_deaths: result.history.fastDeaths,
      notable: result.history.notable as unknown as Record<string, unknown>[],
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'chain,deployer_address' },
  ).then(() => undefined, () => undefined);

  return NextResponse.json({
    available: true,
    deployer: result.deployer,
    launchCount,
    ruggedCount,
    riskLabel,
    summary: buildSummary(launchCount, ruggedCount, riskLabel),
  } satisfies DeployerSummary);
}
