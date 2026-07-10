import 'server-only';
import { probYes, multiplierFor, realizedVolPerSec } from './odds';
import { sampleDtSeconds, type Spot } from './priceFeed';

/** Horizons (seconds) every tracked token always has an open market at. */
export const HORIZONS = [60, 300, 900] as const;
export type Horizon = (typeof HORIZONS)[number];

/** Band (fractional move for the target strike) scales with horizon so every
 *  market opens near-the-money and stays interesting: ~0.15% at 60s up to
 *  ~0.8% at 900s. */
export const HORIZON_BAND: Record<number, number> = {
  60: 0.0015,
  300: 0.004,
  900: 0.008,
};

export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(4)}`;
}

export function horizonLabel(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/** Human-readable market question, e.g. "Will BTC be above $64,200 in 5m?" */
export function buildQuestion(symbol: string, direction: 'above' | 'below', target: number, horizonSeconds: number): string {
  return `Will ${symbol} be ${direction} ${formatPrice(target)} in ${horizonLabel(horizonSeconds)}?`;
}

export interface MarketOdds {
  probYes: number;
  yesMultiplier: number;
  noMultiplier: number;
  volPerSec: number;
  secondsLeft: number;
}

/**
 * Compute live model odds for a market from a live spot sample and its
 * timestamped series. Pure — every number is derived from real observations.
 */
export function computeOdds(params: {
  price: number;
  target: number;
  direction: 'above' | 'below';
  closesAt: string | number | Date;
  spot: Spot | undefined;
}): MarketOdds {
  const { price, target, direction, closesAt, spot } = params;
  const secondsLeft = Math.max(0, (new Date(closesAt).getTime() - Date.now()) / 1000);
  const dt = spot ? sampleDtSeconds(spot.samples) : 1;
  const volPerSec = realizedVolPerSec(spot?.series ?? [], dt);
  const p = probYes({ price, target, direction, secondsLeft, volPerSec });
  return {
    probYes: p,
    yesMultiplier: multiplierFor(p),
    noMultiplier: multiplierFor(1 - p),
    volPerSec,
    secondsLeft,
  };
}
