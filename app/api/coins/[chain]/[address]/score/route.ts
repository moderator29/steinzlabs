import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCoin, getStats } from '@/lib/coins/coinService';
import { getPlatformHolders } from '@/lib/coins/social';
import { scanTokenSecurity } from '@/lib/security/goplusService';
import { computeNakaScore, type NakaRiskLevel } from '@/lib/coins/nakaScore';

export const dynamic = 'force-dynamic';

/**
 * Naka Score for a coin: one honest 0-100 health read built only from real
 * signals (liquidity, on-platform holders, 24h buy/sell flow, rug-risk, pool
 * age). Every input is fetched live; any signal we cannot measure is left out
 * of both the earned points and the possible max, so the ratio stays fair.
 * When nothing can be measured the score is null (an honest "not enough data").
 *
 * Response: { score, grade, breakdown }
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);

  const coin = await resolveCoin(chain, addr).catch(() => null);
  if (!coin) {
    return NextResponse.json({ score: null, grade: null, breakdown: [] });
  }

  const [stats, holders, riskLevel] = await Promise.all([
    getStats(chain, addr, coin.pairAddress).catch(() => null),
    getPlatformHolders(chain, addr, coin.priceUsd ?? null, 200).catch(() => [] as unknown[]),
    resolveRiskLevel(addr, chain),
  ]);

  const result = computeNakaScore({
    liquidityUsd: coin.liquidityUsd,
    platformHolders: holders.length,
    buys24h: stats?.buys ?? coin.txns24h?.buys ?? null,
    sells24h: stats?.sells ?? coin.txns24h?.sells ?? null,
    riskLevel,
    pairCreatedAt: coin.pairCreatedAt,
  });

  return NextResponse.json(result);
}

/**
 * Map the real security read to the three-tier rug-risk level using the same
 * logic as the risk route. A payload with no usable keys means "no data", which
 * stays 'unknown' (excluded from scoring) rather than a fabricated clean pass.
 */
async function resolveRiskLevel(addr: string, chain: string): Promise<NakaRiskLevel> {
  try {
    const sec = await scanTokenSecurity(addr, chain);
    const raw = (sec.raw ?? {}) as Record<string, unknown>;
    if (Object.keys(raw).filter((k) => k !== '_holders').length === 0) return 'unknown';

    const hardTrap = sec.isHoneypot || sec.cannotSellAll || sec.cannotBuy || sec.ownerCanChangeBalance;
    if (hardTrap || sec.safetyLevel === 'DANGER' || sec.safetyLevel === 'WARNING') return 'high';
    if (sec.safetyLevel === 'CAUTION') return 'medium';
    return 'low';
  } catch {
    return 'unknown';
  }
}
