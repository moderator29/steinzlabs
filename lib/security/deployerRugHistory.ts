/**
 * Deployer rug-history scorer. Given a creator wallet address and
 * the list of tokens they've previously deployed, returns a rug
 * score 0..100 plus the contributing past incidents.
 *
 * Pure scorer — caller passes already-fetched history records. The
 * Arkham / on-chain history fetch lives in the service layer; this
 * file only ranks.
 *
 * Audit §5.8 B.4 — fresh primitive.
 */

export interface DeployerToken {
  tokenAddress: string;
  symbol: string;
  /** Unix seconds when the token was deployed. */
  deployedAtSec: number;
  /** Peak market cap reached (USD). */
  peakMcapUsd: number;
  /** Current market cap (USD). 0 == dead. */
  currentMcapUsd: number;
  /** True when the token is on a known rug / scam list. */
  flaggedAsRug?: boolean;
  /** Token age in seconds at time of "dead" mark, if dead. */
  ageAtDeathSec?: number;
}

export type RugTier = 'clean' | 'caution' | 'risky' | 'serial-rugger';

export interface DeployerRugHistory {
  score: number; // 0..100, higher == more rug history
  tier: RugTier;
  totalDeployed: number;
  totalDead: number;
  totalFlagged: number;
  /** Tokens that died within 7 days of deploy (the canonical rug
   *  signature). */
  fastDeaths: number;
  notable: DeployerToken[];
}

const DEAD_THRESHOLD_PCT = 0.05;        // current mcap < 5% of peak == dead
const FAST_DEATH_WINDOW_SEC = 7 * 86_400;

function isDead(t: DeployerToken): boolean {
  if (t.peakMcapUsd <= 0) return false;
  return t.currentMcapUsd <= t.peakMcapUsd * DEAD_THRESHOLD_PCT;
}

export function scoreDeployerRugHistory(history: DeployerToken[]): DeployerRugHistory {
  const totalDeployed = history.length;
  if (totalDeployed === 0) {
    return {
      score: 0,
      tier: 'clean',
      totalDeployed: 0,
      totalDead: 0,
      totalFlagged: 0,
      fastDeaths: 0,
      notable: [],
    };
  }
  let totalDead = 0;
  let totalFlagged = 0;
  let fastDeaths = 0;
  const notable: DeployerToken[] = [];

  for (const t of history) {
    const dead = isDead(t);
    if (dead) totalDead += 1;
    if (t.flaggedAsRug) totalFlagged += 1;
    if (dead && typeof t.ageAtDeathSec === 'number' && t.ageAtDeathSec <= FAST_DEATH_WINDOW_SEC) {
      fastDeaths += 1;
    }
    if (dead || t.flaggedAsRug) notable.push(t);
  }

  // Score blends raw rates with hard penalties for fast-death pattern.
  const deathRate = totalDead / totalDeployed;
  const flagRate = totalFlagged / totalDeployed;
  const fastRate = fastDeaths / totalDeployed;
  let score = Math.round(
    Math.min(100,
      deathRate * 40 +
      flagRate * 40 +
      fastRate * 50 +
      (totalDeployed >= 5 && fastDeaths >= 2 ? 20 : 0),
    ),
  );

  let tier: RugTier = 'clean';
  if (score >= 70) tier = 'serial-rugger';
  else if (score >= 40) tier = 'risky';
  else if (score >= 15) tier = 'caution';

  notable.sort((a, b) => b.peakMcapUsd - a.peakMcapUsd);
  return {
    score,
    tier,
    totalDeployed,
    totalDead,
    totalFlagged,
    fastDeaths,
    notable: notable.slice(0, 5),
  };
}
