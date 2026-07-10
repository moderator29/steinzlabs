import 'server-only';

/**
 * Naka Predict — honest odds engine.
 *
 * Prices short-horizon YES/NO markets with a lognormal (Black-Scholes-style)
 * model. Every probability is a MODEL ESTIMATE derived from real, recently
 * observed price samples — never a fabricated or house-tuned number. The house
 * "edge" is a transparent, fixed haircut applied to the fair multiplier so the
 * free-points economy is sustainable, not a hidden manipulation of the odds.
 *
 * Model: assume log-price follows Brownian motion with volatility σ (per
 * second). Over a horizon of T seconds the terminal price S_T is lognormal:
 *
 *     ln(S_T) ~ Normal( ln(S) - 0.5 σ² T ,  σ² T )
 *
 * so for a "below" market (YES = "price ends below target K"):
 *
 *     P(S_T < K) = Φ( ( ln(K/S) - 0.5 σ² T ) / ( σ √T ) )
 *
 * and "above" is the complement.
 */

/** Minimum per-second volatility floor. ~5e-5/s ≈ 25% annualized — a sane,
 *  non-zero floor so we never quote a degenerate certainty when samples are
 *  too few or too flat to estimate σ honestly. */
export const MIN_VOL_PER_SEC = 0.00005;

/** Odds are always clamped to this band so no market is ever quoted as a
 *  near-certainty (which would produce absurd multipliers and a dead game). */
export const PROB_MIN = 0.02;
export const PROB_MAX = 0.98;

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 error-function
 * approximation. Max absolute error ~1.5e-7 — far tighter than we need.
 */
export function normCdf(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2); // 1/√(2π) · e^(−x²/2)
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}

/**
 * Realized per-sample volatility estimated from the log returns of recent
 * price samples. When the caller's samples are spaced `dtSeconds` apart, the
 * per-second vol is the per-sample stdev divided by √dt.
 *
 * Returns a small positive floor when there are too few / too flat samples to
 * form an honest estimate (fewer than 3 usable returns).
 */
export function realizedVolPerSec(prices: number[], dtSeconds = 1): number {
  const clean = (prices ?? []).filter((p) => Number.isFinite(p) && p > 0);
  if (clean.length < 4) return MIN_VOL_PER_SEC;

  const returns: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    returns.push(Math.log(clean[i] / clean[i - 1]));
  }
  if (returns.length < 3) return MIN_VOL_PER_SEC;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (returns.length - 1);
  const perSample = Math.sqrt(Math.max(variance, 0));
  const dt = dtSeconds > 0 ? dtSeconds : 1;
  const perSec = perSample / Math.sqrt(dt);

  return Math.max(perSec, MIN_VOL_PER_SEC);
}

export interface ProbYesArgs {
  price: number; // current spot S
  target: number; // strike K
  direction: 'above' | 'below';
  secondsLeft: number; // horizon T (seconds remaining)
  volPerSec: number; // σ per second
}

/**
 * Model probability that the market resolves YES, clamped to [0.02, 0.98].
 */
export function probYes({ price, target, direction, secondsLeft, volPerSec }: ProbYesArgs): number {
  const S = price;
  const K = target;
  const T = Math.max(secondsLeft, 1); // never divide by zero at the buzzer
  const sigma = Math.max(volPerSec, MIN_VOL_PER_SEC);

  if (!(S > 0) || !(K > 0)) return 0.5;

  const denom = sigma * Math.sqrt(T);
  const d = (Math.log(K / S) - 0.5 * sigma * sigma * T) / denom;
  const pBelow = normCdf(d); // P(S_T < K)

  const p = direction === 'below' ? pBelow : 1 - pBelow;
  return Math.min(PROB_MAX, Math.max(PROB_MIN, p));
}

/**
 * Fair-value multiplier for a side whose model win probability is `p`, minus a
 * transparent fixed house edge. `1/p` is the fair (zero-edge) payout; we shave
 * `(1 - edge)` off it. Floored at 1.01 so a stake can never lose value on a win.
 */
export function multiplierFor(p: number, edge = 0.06): number {
  const prob = Math.min(PROB_MAX, Math.max(PROB_MIN, p));
  const fair = 1 / prob;
  const withEdge = fair * (1 - edge);
  return Math.max(1.01, Math.round(withEdge * 100) / 100);
}
