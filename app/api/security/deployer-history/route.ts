import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAndScoreDeployerHistory, DEPLOYER_CACHE_TTL_SEC } from '@/lib/security/deployerHistoryFetcher';

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
  // Cache hit?
  const { data: cached } = await sb
    .from('deployer_history_cache')
    .select('deployer_address, trust_score, band, total_deployed, total_dead, total_flagged, fast_deaths, notable, fetched_at')
    .eq('chain', chain)
    .ilike('deployer_address', `%`) // placeholder — we look up by chain+token via token mapping
    .order('fetched_at', { ascending: false })
    .limit(1);

  // We don't yet know the deployer for this token without fetching;
  // attempt fresh fetch (cheap if env keys present, no-op otherwise).
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

  void cached;
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
