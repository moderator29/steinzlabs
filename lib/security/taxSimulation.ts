/**
 * Tax-simulation comparator. GoPlus reports a claimed buy_tax /
 * sell_tax for each token, but tokens can lie — they advertise 5%
 * and skim 30% silently. This module compares the claimed vs the
 * observed-on-chain tax from a 1-wei eth_call simulation and surfaces
 * the delta so the user sees the actual cost before signing.
 *
 * The lib does NOT make the eth_call itself — that requires an RPC
 * client + the token's transfer ABI which is provider-specific. This
 * file pairs claimed/observed numbers and labels the divergence.
 *
 * Audit §5.8 B.4.
 */

export interface TaxSimulationInput {
  /** Tax rate the token contract advertises (0..1). */
  claimedBuyTax: number;
  claimedSellTax: number;
  /** Tax rate observed via 1-wei eth_call simulation (0..1). */
  observedBuyTax: number;
  observedSellTax: number;
}

export type TaxFlag = 'match' | 'minor' | 'major' | 'lying';

export interface TaxSimulationResult {
  buy: { claimed: number; observed: number; delta: number; flag: TaxFlag };
  sell: { claimed: number; observed: number; delta: number; flag: TaxFlag };
  /** Worst flag across buy + sell, for at-a-glance UI severity. */
  worst: TaxFlag;
}

function flagFor(claimed: number, observed: number): TaxFlag {
  const delta = observed - claimed;
  if (!Number.isFinite(delta)) return 'match';
  const abs = Math.abs(delta);
  // <0.5% absolute deviation -> match. <2% -> minor. <5% -> major.
  // >=5% absolute discrepancy is the "actively lying about tax" tier.
  if (abs < 0.005) return 'match';
  if (abs < 0.02) return 'minor';
  if (abs < 0.05) return 'major';
  return 'lying';
}

const FLAG_RANK: Record<TaxFlag, number> = { match: 0, minor: 1, major: 2, lying: 3 };

export function simulateTax(input: TaxSimulationInput): TaxSimulationResult {
  const buyFlag = flagFor(input.claimedBuyTax, input.observedBuyTax);
  const sellFlag = flagFor(input.claimedSellTax, input.observedSellTax);
  const worst = FLAG_RANK[buyFlag] >= FLAG_RANK[sellFlag] ? buyFlag : sellFlag;
  return {
    buy: {
      claimed: input.claimedBuyTax,
      observed: input.observedBuyTax,
      delta: input.observedBuyTax - input.claimedBuyTax,
      flag: buyFlag,
    },
    sell: {
      claimed: input.claimedSellTax,
      observed: input.observedSellTax,
      delta: input.observedSellTax - input.claimedSellTax,
      flag: sellFlag,
    },
    worst,
  };
}
