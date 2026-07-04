import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAndScoreDeployerHistory, resolveDeployer, DEPLOYER_CACHE_TTL_SEC } from '@/lib/security/deployerHistoryFetcher';

type Band = 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger';

interface CacheRow {
  deployer_address: string; trust_score: number; band: string;
  total_deployed: number; total_dead: number;
}

function cacheRowToResponse(row: CacheRow) {
  return {
    available: true,
    deployer: row.deployer_address,
    trustScore: row.trust_score,
    band: row.band as Band,
    totalDeployed: row.total_deployed,
    rugged: row.total_dead,
    abandoned: 0,
    active: Math.max(0, (row.total_deployed ?? 0) - (row.total_dead ?? 0)),
    cache_ttl_sec: DEPLOYER_CACHE_TTL_SEC,
    cached: true,
  };
}

/**
 * GET /api/security/deployer-history?chain=...&token=...
 *
 * Returns the deployer's rug-history trust band + counters. Cached
 * for 24h in deployer_history_cache. Shape matches
 * DeployerHistoryPanelProps so SecurityPanel can drop the JSON in.
 *
 * Mapping from scoreDeployerRugHistory().tier (clean/caution/risky/
 * serial-rugger) to the panel's band: clean→clean, caution→caution,
 * risky→dangerous, serial-rugger→serial-rugger. Tokens with no prior
 * history and a clean current contract surface as 'pristine'.
 */

const Q = z.object({
  chain: z.string().min(1).max(32),
  token: z.string().min(8).max(128),
});

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    chain: req.nextUrl.searchParams.get('chain'),
    token: req.nextUrl.searchParams.get('token'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { chain, token } = parsed.data;

  const sb = getSupabaseAdmin();
  const freshSince = new Date(Date.now() - DEPLOYER_CACHE_TTL_SEC * 1000).toISOString();

  // Real cache serve: the cache is keyed by (chain, deployer), so first resolve
  // the deployer cheaply (one call, EVM), then look up a FRESH row and return it
  // WITHOUT the expensive full-history scan. Previously this query matched every
  // deployer ('%') and then discarded the result (`void cached`), so the 24h
  // cache never served and every request re-fetched from Etherscan/Helius.
  const knownDeployer = await resolveDeployer(chain, token).catch(() => null);
  if (knownDeployer) {
    const { data: hit } = await sb
      .from('deployer_history_cache')
      .select('deployer_address, trust_score, band, total_deployed, total_dead')
      .eq('chain', chain)
      .ilike('deployer_address', knownDeployer)
      .gte('fetched_at', freshSince)
      .maybeSingle<CacheRow>();
    if (hit) return NextResponse.json(cacheRowToResponse(hit));
  }

  // Cache miss (or non-EVM chain) → full fetch + score, then persist for 24h.
  const result = await fetchAndScoreDeployerHistory(chain, token);
  if (!result) {
    // Surface most recent cache row for this chain if any, otherwise null
    return NextResponse.json({ available: false, reason: 'No deployer history source configured for this chain or fetch failed' });
  }

  // Map scorer.tier → panel.band
  const band: 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger' =
    result.history.tier === 'serial-rugger' ? 'serial-rugger'
      : result.history.tier === 'risky'      ? 'dangerous'
      : result.history.tier === 'caution'    ? 'caution'
      : result.history.totalDeployed <= 1    ? 'pristine'
      : 'clean';

  await sb.from('deployer_history_cache').upsert(
    {
      chain,
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
  );

  return NextResponse.json({
    available: true,
    deployer: result.deployer,
    trustScore: 100 - result.history.score,
    band,
    totalDeployed: result.history.totalDeployed,
    rugged: result.history.totalDead,
    abandoned: 0,
    active: Math.max(0, result.history.totalDeployed - result.history.totalDead),
    cache_ttl_sec: DEPLOYER_CACHE_TTL_SEC,
  });
}
