/**
 * Deployer rug-history lookup. Given a contract deployer address +
 * a list of their prior deployments with outcomes, return a 0..100
 * trust score for that deployer + the per-token outcome list the
 * UI surfaces inline.
 *
 * The audit caught that a SecurityPanel showing 'all green' for the
 * current contract while the deployer has 9 prior rugs gives users
 * false confidence. Pulling deployer history into the same panel
 * fixes that. Audit §B.4 P1.
 */

export type DeployerOutcome = 'rugged' | 'abandoned' | 'active' | 'unknown';

export interface DeployerToken {
  /** Token contract this deployer created. */
  address: string;
  /** UNIX seconds of deploy. */
  deployedAt: number;
  /** What happened to it. */
  outcome: DeployerOutcome;
  /** Symbol if known. */
  symbol?: string | null;
  /** Peak FDV in USD if known — gives weight to rugged-after-big-pump. */
  peakFdvUsd?: number | null;
}

export interface DeployerVerdict {
  /** 0 (worst) to 100 (clean track record). */
  trustScore: number;
  totalDeployed: number;
  rugged: number;
  abandoned: number;
  active: number;
  /** Categorical label for the UI badge. */
  band: 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger';
}

export function evaluateDeployerHistory(prior: DeployerToken[]): DeployerVerdict {
  if (prior.length === 0) {
    return {
      trustScore: 50,
      totalDeployed: 0,
      rugged: 0,
      abandoned: 0,
      active: 0,
      band: 'caution', // unknown deployer — neutral, not pristine
    };
  }

  let rugged = 0;
  let abandoned = 0;
  let active = 0;
  let weightedRug = 0;
  let weightedTotal = 0;

  for (const t of prior) {
    const weight = 1 + Math.log10(Math.max(1_000, t.peakFdvUsd ?? 1_000)) - 3;
    weightedTotal += weight;
    if (t.outcome === 'rugged') {
      rugged += 1;
      weightedRug += weight;
    } else if (t.outcome === 'abandoned') {
      abandoned += 1;
      weightedRug += weight * 0.4; // abandons are softer signal than rugs
    } else if (t.outcome === 'active') {
      active += 1;
    }
  }

  const rugShare = weightedTotal === 0 ? 0 : weightedRug / weightedTotal;
  const trustScore = Math.round(Math.max(0, Math.min(100, 100 - rugShare * 100)));

  let band: DeployerVerdict['band'];
  if (rugged === 0 && abandoned === 0 && active >= 3) band = 'pristine';
  else if (trustScore >= 75) band = 'clean';
  else if (trustScore >= 45) band = 'caution';
  else if (rugged >= 3) band = 'serial-rugger';
  else band = 'dangerous';

  return { trustScore, totalDeployed: prior.length, rugged, abandoned, active, band };
}
