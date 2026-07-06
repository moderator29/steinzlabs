import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLiquidityDepth } from '@/lib/services/liquidityDepth';
import { getBestPair } from '@/lib/services/dexscreener';
import { fetchAndScoreDeployerHistory } from '@/lib/security/deployerHistoryFetcher';

export const runtime = 'nodejs';

// Rug-Risk Composite — one honest read of a token's live rug-ENABLING
// conditions, composed from real, independently-sourced signals:
//   1. Liquidity fragility — how thin the pool is (DexScreener depth). Thin
//      liquidity is what lets a rug crater the price; deep liquidity can't.
//   2. Liquidity/FDV backing — how little real liquidity backs the paper
//      valuation. A huge FDV on a shallow pool is a classic rug setup.
//   3. Deployer trust — has this creator rugged before (live Etherscan history
//      + the same scorer the Security Panel and Deployer DNA use).
//
// DELIBERATELY NOT A PREDICTION. We do not claim to know WHEN a token will rug —
// that would be fabricated. We score the present, measurable conditions that
// enable a rug, show every contributing factor transparently, and mark any
// factor we can't source as null (—), excluding it from the composite and
// lowering the stated confidence rather than guessing.

const Q = z.object({
  chain: z.string().min(1).max(32),
  token: z.string().min(8).max(128),
});

type Band = 'low' | 'elevated' | 'high' | 'severe';
function band(score: number): Band {
  if (score >= 75) return 'severe';
  if (score >= 50) return 'high';
  if (score >= 25) return 'elevated';
  return 'low';
}

function liquidityRisk(totalLiqUsd: number, poolCount: number): number {
  let r =
    totalLiqUsd < 10_000 ? 90 :
    totalLiqUsd < 50_000 ? 70 :
    totalLiqUsd < 150_000 ? 45 :
    totalLiqUsd < 500_000 ? 25 : 10;
  if (poolCount <= 1) r = Math.min(100, r + 10); // single pool = one yank kills it
  return r;
}
function lpFdvRisk(liqUsd: number, fdv: number): number | null {
  if (!(fdv > 0) || !(liqUsd >= 0)) return null;
  const ratio = liqUsd / fdv;
  return ratio < 0.02 ? 85 : ratio < 0.05 ? 65 : ratio < 0.1 ? 45 : ratio < 0.2 ? 25 : 10;
}

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    chain: req.nextUrl.searchParams.get('chain'),
    token: req.nextUrl.searchParams.get('token'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'chain and token required' }, { status: 400 });
  const { chain, token } = parsed.data;
  const lower = chain.toLowerCase();

  try {
    const [depth, best, deployer] = await Promise.all([
      getLiquidityDepth(token, lower).catch(() => null),
      getBestPair(token).catch(() => null),
      fetchAndScoreDeployerHistory(lower, token).catch(() => null),
    ]);

    const factors: Array<{ key: string; label: string; score: number; weight: number; detail: string }> = [];

    if (depth && depth.totalLiquidityUsd > 0) {
      const s = liquidityRisk(depth.totalLiquidityUsd, depth.poolCount);
      factors.push({
        key: 'liquidity',
        label: 'Liquidity fragility',
        score: s,
        weight: 0.35,
        detail: `$${Math.round(depth.totalLiquidityUsd).toLocaleString()} across ${depth.poolCount} pool${depth.poolCount === 1 ? '' : 's'}${depth.safeSizeUsd != null ? ` · ~$${Math.round(depth.safeSizeUsd).toLocaleString()} moves it <1%` : ''}`,
      });
    }

    const liqUsd = Number(best?.liquidity?.usd) || (depth?.totalLiquidityUsd ?? 0);
    const fdv = Number(best?.fdv) || Number(best?.marketCap) || 0;
    const lpfdv = lpFdvRisk(liqUsd, fdv);
    if (lpfdv != null) {
      factors.push({
        key: 'lp_fdv',
        label: 'Liquidity backing',
        score: lpfdv,
        weight: 0.25,
        detail: `${((liqUsd / fdv) * 100).toFixed(1)}% of a $${Math.round(fdv).toLocaleString()} FDV is real liquidity`,
      });
    }

    if (deployer) {
      factors.push({
        key: 'deployer',
        label: 'Deployer history',
        score: deployer.history.score, // 0..100, higher == more rug history
        weight: 0.40,
        detail: deployer.history.totalDeployed > 0
          ? `${deployer.history.tier}, ${deployer.history.totalDeployed} deployed, ${deployer.history.totalDead} dead, ${deployer.history.fastDeaths} fast deaths`
          : 'no prior deployments found for this creator',
      });
    }

    if (factors.length === 0) {
      return NextResponse.json({
        available: false,
        reason: 'Could not source any rug-risk factor for this token (no DEX liquidity data and no deployer history).',
      });
    }

    const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
    const composite = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight);
    // Confidence scales with how many of the three factors we actually have.
    const confidence = factors.length >= 3 ? 'high' : factors.length === 2 ? 'medium' : 'low';

    return NextResponse.json({
      available: true,
      chain: lower,
      token,
      symbol: best?.baseToken?.symbol ?? depth?.symbol ?? null,
      composite,
      band: band(composite),
      confidence,
      factorsUsed: factors.length,
      factors: factors.map((f) => ({ key: f.key, label: f.label, score: f.score, band: band(f.score), detail: f.detail })),
      note: 'Live rug-enabling conditions, not a timing prediction. Factors marked — could not be sourced and are excluded.',
    }, { headers: { 'Cache-Control': 'public, s-maxage=120' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 502 });
  }
}
