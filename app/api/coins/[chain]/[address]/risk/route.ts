import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { scanTokenSecurity, SecurityRateLimitError } from '@/lib/security/goplusService';

export const dynamic = 'force-dynamic';

/**
 * Compact, honest rug-risk read for a coin, sourced from the platform's real
 * token-security service. Never fabricates a score: when the provider has no
 * usable data (or is temporarily rate-limited) the level is 'unknown'.
 *
 * Response: { level, reasons, flags }
 *   level  : 'low' | 'medium' | 'high' | 'unknown'
 *   reasons: short human strings drawn only from confirmed checks
 *   flags  : the specific booleans/numbers behind the level
 */

type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

interface RiskResponse {
  level: RiskLevel;
  reasons: string[];
  flags: {
    honeypot: boolean;
    cannotSellAll: boolean;
    cannotBuy: boolean;
    mintable: boolean;
    hiddenOwner: boolean;
    canTakeBackOwnership: boolean;
    ownerCanChangeBalance: boolean;
    selfDestruct: boolean;
    freezable: boolean;
    isOpenSource: boolean | null;
    buyTaxPct: number | null;
    sellTaxPct: number | null;
    topHolderPct: number | null;
  };
}

const UNKNOWN: RiskResponse = {
  level: 'unknown',
  reasons: [],
  flags: {
    honeypot: false, cannotSellAll: false, cannotBuy: false, mintable: false,
    hiddenOwner: false, canTakeBackOwnership: false, ownerCanChangeBalance: false,
    selfDestruct: false, freezable: false, isOpenSource: null,
    buyTaxPct: null, sellTaxPct: null, topHolderPct: null,
  },
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);

  try {
    const sec = await scanTokenSecurity(addr, chain);

    // The provider omits the dynamic sell-simulation fields for tokens it has
    // never analyzed; a raw payload with no keys means "no data", not "clean".
    const raw = (sec.raw ?? {}) as Record<string, unknown>;
    if (Object.keys(raw).filter((k) => k !== '_holders').length === 0) {
      return NextResponse.json(UNKNOWN);
    }

    const reasons: string[] = [];
    if (sec.isHoneypot) reasons.push('Flagged as a honeypot');
    if (sec.cannotSellAll) reasons.push('Holders may not be able to sell all tokens');
    if (sec.cannotBuy) reasons.push('Buying appears blocked');
    if (sec.ownerCanChangeBalance) reasons.push('Owner can modify balances');
    if (sec.canTakeBackOwnership) reasons.push('Ownership can be reclaimed');
    if (sec.hasHiddenOwner) reasons.push('Contract has a hidden owner');
    if (sec.selfDestruct) reasons.push('Contract can self-destruct');
    if (sec.isMintable) reasons.push('Supply is mintable');
    if (sec.freezable) reasons.push('Token accounts can be frozen');
    if (sec.isOpenSource === false) reasons.push('Contract source is not verified');
    if (sec.buyTax > 0.1) reasons.push(`High buy tax (${Math.round(sec.buyTax * 100)}%)`);
    if (sec.sellTax > 0.1) reasons.push(`High sell tax (${Math.round(sec.sellTax * 100)}%)`);
    if (sec.topHolderPct > 0.5) reasons.push(`Top holder controls ${Math.round(sec.topHolderPct * 100)}% of supply`);

    // Map the provider's safety rating to a compact three-tier level. Any
    // confirmed hard trap forces 'high' regardless of the composite score.
    let level: RiskLevel;
    const hardTrap = sec.isHoneypot || sec.cannotSellAll || sec.cannotBuy || sec.ownerCanChangeBalance;
    if (hardTrap || sec.safetyLevel === 'DANGER' || sec.safetyLevel === 'WARNING') level = 'high';
    else if (sec.safetyLevel === 'CAUTION') level = 'medium';
    else level = 'low';

    const flags: RiskResponse['flags'] = {
      honeypot: sec.isHoneypot,
      cannotSellAll: sec.cannotSellAll,
      cannotBuy: sec.cannotBuy,
      mintable: sec.isMintable,
      hiddenOwner: sec.hasHiddenOwner,
      canTakeBackOwnership: sec.canTakeBackOwnership,
      ownerCanChangeBalance: sec.ownerCanChangeBalance,
      selfDestruct: sec.selfDestruct,
      freezable: !!sec.freezable,
      isOpenSource: sec.isOpenSource,
      buyTaxPct: Number.isFinite(sec.buyTax) ? Math.round(sec.buyTax * 1000) / 10 : null,
      sellTaxPct: Number.isFinite(sec.sellTax) ? Math.round(sec.sellTax * 1000) / 10 : null,
      topHolderPct: Number.isFinite(sec.topHolderPct) ? Math.round(sec.topHolderPct * 1000) / 10 : null,
    };

    return NextResponse.json({ level, reasons, flags } satisfies RiskResponse);
  } catch (err) {
    // Rate-limited or unreachable: stay honest, report 'unknown' rather than a
    // fabricated clean pass.
    if (err instanceof SecurityRateLimitError) {
      return NextResponse.json(UNKNOWN);
    }
    return NextResponse.json(UNKNOWN);
  }
}
