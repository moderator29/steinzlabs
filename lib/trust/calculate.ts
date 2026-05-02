/**
 * §7 — Naka Trust Score.
 *
 * Composite 0–100 score per (chain, token_address). Five layers, weighted:
 *   security (40%) | liquidity (20%) | holders (15%) | market (15%) | social (10%)
 *
 * Sources:
 *   security  → GoPlus token_security  (lib/security/goplusService.ts)
 *   liquidity → DexScreener pair       (lib/services/dexscreener.ts)
 *   holders   → GoPlus holderCount + top10 concentration (when present)
 *   market    → DexScreener priceChange + volume / pairCreatedAt
 *   social    → LunarCrush score (lib/lunarcrush) — optional, returns 50 (neutral)
 *               when key/data missing rather than penalising the token.
 *
 * Each layer returns 0–100 INDEPENDENTLY of weight; the composite is
 * weighted-average. Graceful degradation: a missing source contributes a
 * mid-range (50) score so we never trash a token because Helius is down.
 */

import { getTokenSecurity } from "@/lib/services/goplus";
import { getBestPair } from "@/lib/services/dexscreener";
import type { DexPair } from "@/lib/services/dexscreener";

export const TRUST_WEIGHTS = {
  security: 0.4,
  liquidity: 0.2,
  holders: 0.15,
  market: 0.15,
  social: 0.1,
} as const;

export type TrustBand = "highly_trusted" | "trusted" | "caution" | "high_risk" | "dangerous";

export function bandFor(score: number): { band: TrustBand; label: string; color: string } {
  if (score >= 80) return { band: "highly_trusted", label: "Highly Trusted", color: "#10B981" };
  if (score >= 60) return { band: "trusted", label: "Trusted", color: "#3B82F6" };
  if (score >= 40) return { band: "caution", label: "Caution", color: "#F59E0B" };
  if (score >= 20) return { band: "high_risk", label: "High Risk", color: "#F97316" };
  return { band: "dangerous", label: "Dangerous — Avoid", color: "#EF4444" };
}

export interface TrustLayers {
  security: number;
  liquidity: number;
  holders: number;
  market: number;
  social: number;
}

export interface TrustResult {
  score: number;
  band: TrustBand;
  bandLabel: string;
  bandColor: string;
  layers: TrustLayers;
  details: Record<string, unknown>;
  computedAt: string;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function liquidityLayer(pair: DexPair | null): number {
  if (!pair) return 30; // unknown liquidity → low-ish, not zero
  const liqUsd = pair.liquidity?.usd ?? 0;
  const mcap = pair.fdv ?? pair.marketCap ?? 0;
  let score = 0;

  // Total liquidity tiers (ramped, not stepped).
  if (liqUsd >= 1_000_000) score += 60;
  else if (liqUsd >= 250_000) score += 45;
  else if (liqUsd >= 50_000) score += 30;
  else if (liqUsd >= 10_000) score += 15;

  // liq:mcap ratio — higher is better, capped at 0.2 → 30 pts.
  if (mcap > 0) {
    const ratio = Math.min(0.2, liqUsd / mcap);
    score += Math.round((ratio / 0.2) * 30);
  }

  // 24h volume — modest contribution.
  const vol24 = pair.volume?.h24 ?? 0;
  if (vol24 >= 100_000) score += 10;
  else if (vol24 >= 10_000) score += 5;

  return clamp(score);
}

function holdersLayer(holderCount: number | null, top10Pct: number | null): number {
  if (holderCount == null) return 50;
  let score = 0;
  if (holderCount >= 10_000) score += 60;
  else if (holderCount >= 2_000) score += 45;
  else if (holderCount >= 500) score += 30;
  else if (holderCount >= 100) score += 15;

  if (top10Pct != null) {
    // Lower concentration is better. 0%→40, 100%→0.
    score += Math.round(Math.max(0, 40 * (1 - top10Pct / 100)));
  } else {
    score += 20;
  }
  return clamp(score);
}

function marketLayer(pair: DexPair | null): number {
  if (!pair) return 40;
  let score = 0;

  // Days since launch — older = more proven.
  const ageDays = pair.pairCreatedAt
    ? Math.max(0, (Date.now() - pair.pairCreatedAt) / 86_400_000)
    : 0;
  if (ageDays >= 365) score += 30;
  else if (ageDays >= 90) score += 22;
  else if (ageDays >= 30) score += 15;
  else if (ageDays >= 7) score += 8;

  // Volatility — lower 24h |%| is calmer.
  const ch24 = Math.abs(pair.priceChange?.h24 ?? 0);
  if (ch24 < 5) score += 30;
  else if (ch24 < 15) score += 20;
  else if (ch24 < 40) score += 10;

  // Buy/sell pressure — closer to 1:1 is healthier.
  const buys = pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.h24?.sells ?? 0;
  const total = buys + sells;
  if (total > 0) {
    const ratio = buys / total;
    const balance = 1 - Math.abs(0.5 - ratio) * 2; // 1 at 50/50, 0 at 100/0
    score += Math.round(balance * 25);
  } else {
    score += 8;
  }

  // Mcap tier.
  const mcap = pair.fdv ?? pair.marketCap ?? 0;
  if (mcap >= 100_000_000) score += 15;
  else if (mcap >= 10_000_000) score += 10;
  else if (mcap >= 1_000_000) score += 5;

  return clamp(score);
}

function securityLayer(security: Awaited<ReturnType<typeof getTokenSecurity>> | null): number {
  if (!security) return 40;
  // GoPlus already produces a 0–100 trustScore; honor it as the layer score.
  // Honeypots / cannot-sell collapse the layer regardless of other flags.
  if (security.isHoneypot) return 0;
  if (security.cannotSellAll) return 5;
  return clamp(security.trustScore);
}

export interface CalculateInput {
  chain: string;
  tokenAddress: string;
  /** Top-10 holder concentration in % when known (separate fetch). */
  top10ConcentrationPct?: number | null;
  /** LunarCrush galaxy score (0–100) when known. */
  socialScore?: number | null;
}

export async function calculateTrustScore(input: CalculateInput): Promise<TrustResult> {
  const { chain, tokenAddress } = input;

  const [security, pair] = await Promise.all([
    getTokenSecurity(tokenAddress, chain).catch(() => null),
    getBestPair(tokenAddress).catch(() => null),
  ]);

  const layers: TrustLayers = {
    security: securityLayer(security),
    liquidity: liquidityLayer(pair),
    holders: holdersLayer(security?.holderCount ?? null, input.top10ConcentrationPct ?? null),
    market: marketLayer(pair),
    social: input.socialScore != null ? clamp(input.socialScore) : 50,
  };

  const composite = clamp(
    layers.security * TRUST_WEIGHTS.security +
      layers.liquidity * TRUST_WEIGHTS.liquidity +
      layers.holders * TRUST_WEIGHTS.holders +
      layers.market * TRUST_WEIGHTS.market +
      layers.social * TRUST_WEIGHTS.social,
  );

  const band = bandFor(composite);

  return {
    score: composite,
    band: band.band,
    bandLabel: band.label,
    bandColor: band.color,
    layers,
    details: {
      tokenAddress,
      chain,
      security: security
        ? {
            trustScore: security.trustScore,
            isHoneypot: security.isHoneypot,
            buyTax: security.buyTax,
            sellTax: security.sellTax,
            isOpenSource: security.isOpenSource,
            isMintable: security.isMintable,
            holderCount: security.holderCount,
          }
        : null,
      liquidity: pair
        ? {
            liqUsd: pair.liquidity?.usd ?? null,
            mcap: pair.fdv ?? pair.marketCap ?? null,
            volume24h: pair.volume?.h24 ?? null,
            priceChange24h: pair.priceChange?.h24 ?? null,
            pairCreatedAt: pair.pairCreatedAt ?? null,
          }
        : null,
    },
    computedAt: new Date().toISOString(),
  };
}
