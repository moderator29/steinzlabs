import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  fetchAndScoreDeployerByAddress,
  fetchAndScoreDeployerHistory,
  DEPLOYER_CACHE_TTL_SEC,
} from '@/lib/security/deployerHistoryFetcher';

export const runtime = 'nodejs';

// Deployer DNA — the address-first rap sheet for a token creator. Paste a
// deployer wallet (or a token, which we resolve to its creator) and get the
// full serial-rugger fingerprint: how many tokens they've shipped, how many
// died, the fast-death pattern (tokens dead within 7 days — the canonical rug
// signature), and the notable casualties. Same live scorer the token Security
// Panel uses (Etherscan history + scoreDeployerRugHistory), exposed address-first.
//
// HONEST: no fabricated verdicts. When no on-chain source is configured for the
// chain, or Etherscan returns nothing, we say so (available:false) rather than
// inventing a score. Cached 24h in deployer_history_cache.

type Band = 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger';

const Q = z.object({
  chain: z.string().min(1).max(32),
  address: z.string().min(8).max(128).optional(),
  token: z.string().min(8).max(128).optional(),
});

function tierToBand(tier: string, totalDeployed: number): Band {
  if (tier === 'serial-rugger') return 'serial-rugger';
  if (tier === 'risky') return 'dangerous';
  if (tier === 'caution') return 'caution';
  return totalDeployed <= 1 ? 'pristine' : 'clean';
}

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    chain: req.nextUrl.searchParams.get('chain'),
    address: req.nextUrl.searchParams.get('address') || undefined,
    token: req.nextUrl.searchParams.get('token') || undefined,
  });
  if (!parsed.success || (!parsed.data.address && !parsed.data.token)) {
    return NextResponse.json({ error: 'chain and (address or token) required' }, { status: 400 });
  }
  const { chain, address, token } = parsed.data;
  const lower = chain.toLowerCase();
  const sb = getSupabaseAdmin();

  try {
    // Address-first path: serve a fresh cache row before the expensive scan.
    if (address) {
      const freshSince = new Date(Date.now() - DEPLOYER_CACHE_TTL_SEC * 1000).toISOString();
      const { data: hit } = await sb
        .from('deployer_history_cache')
        .select('deployer_address, trust_score, band, total_deployed, total_dead, total_flagged, fast_deaths, notable')
        .eq('chain', lower)
        .ilike('deployer_address', address)
        .gte('fetched_at', freshSince)
        .maybeSingle();
      if (hit) {
        return NextResponse.json({
          available: true,
          cached: true,
          chain: lower,
          deployer: hit.deployer_address,
          trustScore: hit.trust_score,
          band: hit.band as Band,
          totalDeployed: hit.total_deployed,
          rugged: hit.total_dead,
          flagged: hit.total_flagged ?? 0,
          fastDeaths: hit.fast_deaths ?? 0,
          active: Math.max(0, (hit.total_deployed ?? 0) - (hit.total_dead ?? 0)),
          notable: Array.isArray(hit.notable) ? hit.notable : [],
        });
      }
    }

    const result = address
      ? await fetchAndScoreDeployerByAddress(lower, address)
      : await fetchAndScoreDeployerHistory(lower, token as string);

    if (!result) {
      return NextResponse.json({
        available: false,
        reason: lower === 'solana'
          ? 'Deployer DNA is address-first on EVM chains. For Solana, look a token up by its mint.'
          : 'No deployer-history source configured for this chain, or the on-chain lookup returned nothing.',
      });
    }

    const band = tierToBand(result.history.tier, result.history.totalDeployed);
    const trustScore = 100 - result.history.score;

    // Persist for 24h so repeat lookups are instant and consistent with the panel.
    await sb.from('deployer_history_cache').upsert(
      {
        chain: lower,
        deployer_address: result.deployer,
        trust_score: trustScore,
        band,
        total_deployed: result.history.totalDeployed,
        total_dead: result.history.totalDead,
        total_flagged: result.history.totalFlagged,
        fast_deaths: result.history.fastDeaths,
        notable: result.history.notable as unknown as Record<string, unknown>[],
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'chain,deployer_address' },
    );

    return NextResponse.json({
      available: true,
      chain: lower,
      deployer: result.deployer,
      trustScore,
      rugScore: result.history.score,
      band,
      totalDeployed: result.history.totalDeployed,
      rugged: result.history.totalDead,
      flagged: result.history.totalFlagged,
      fastDeaths: result.history.fastDeaths,
      active: Math.max(0, result.history.totalDeployed - result.history.totalDead),
      notable: result.history.notable.map((t) => ({
        tokenAddress: t.tokenAddress,
        symbol: t.symbol,
        peakMcapUsd: t.peakMcapUsd,
        currentMcapUsd: t.currentMcapUsd,
        flaggedAsRug: !!t.flaggedAsRug,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 502 });
  }
}
