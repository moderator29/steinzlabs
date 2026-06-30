import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { vtxAnalyze } from '@/lib/services/anthropic';
import {
  detectContract,
  type DetectorResult,
} from '@/lib/services/contractDetector';

const schema = z.object({
  address: z.string().trim().min(1).max(100),
  chain: z.string().trim().default('ethereum'),
});

function ageLabel(ms: number | null | undefined): string | undefined {
  if (ms == null || ms < 0) return undefined;
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

/** Compute the security score + risk flags from merged detector data. */
function buildScore(det: DetectorResult): { overallScore: number; riskFlags: string[] } {
  const { token, addr } = det;
  const riskFlags: string[] = [];
  let overallScore = 100;

  if (token) {
    if (token.isHoneypot) { riskFlags.push('Honeypot — tokens cannot be sold'); overallScore -= 45; }
    if (!token.isOpenSource) { riskFlags.push('Contract source code not verified'); overallScore -= 15; }
    if (token.isMintable) { riskFlags.push('Mint function active — supply can be inflated'); overallScore -= 10; }
    if (token.hasHiddenOwner) { riskFlags.push('Hidden owner detected'); overallScore -= 12; }
    if (token.canTakeBackOwnership) { riskFlags.push('Owner can reclaim contract control'); overallScore -= 15; }
    if (token.ownerCanChangeBalance) { riskFlags.push('Owner can modify token balances'); overallScore -= 15; }
    if (token.selfDestruct) { riskFlags.push('Self-destruct function present'); overallScore -= 10; }
    if (token.externalCall) { riskFlags.push('External calls detected'); overallScore -= 5; }
    if (token.cannotBuy) { riskFlags.push('Tokens cannot be purchased'); overallScore -= 20; }
    if (token.cannotSellAll) { riskFlags.push('Cannot sell all tokens'); overallScore -= 15; }
    if (token.buyTax > 0.15) { riskFlags.push(`Very high buy tax: ${(token.buyTax * 100).toFixed(0)}%`); overallScore -= 12; }
    if (token.sellTax > 0.15) { riskFlags.push(`Very high sell tax: ${(token.sellTax * 100).toFixed(0)}%`); overallScore -= 12; }
    if (token.creatorIsTopHolder && token.creatorHoldingPct > 0.05) {
      riskFlags.push(`Dev wallet holds ${(token.creatorHoldingPct * 100).toFixed(1)}% of supply`);
      overallScore -= 15;
    }
  }

  if (addr) {
    if (addr.isMalicious) { riskFlags.push('Address flagged as malicious'); overallScore -= 30; }
    if (addr.isPhishing) { riskFlags.push('Phishing activity detected'); overallScore -= 25; }
    if (addr.isMixer) { riskFlags.push('Linked to mixing services'); overallScore -= 15; }
    if (addr.isBlacklisted) { riskFlags.push('Address is blacklisted'); overallScore -= 20; }
  }

  return { overallScore: Math.max(0, Math.min(100, overallScore)), riskFlags };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { address, chain } = parsed.data;
    const det = await detectContract(address, chain);

    // ── INVALID / UNKNOWN ────────────────────────────────────────────────
    // Wrong address format for the chain, or no on-chain / security / market
    // data from ANY source. Return a clear "no response" — never a fake report.
    if (!det.found) {
      return NextResponse.json({
        found: false,
        reason: det.reason ?? 'invalid_or_unknown',
        address: det.address,
        chain: det.chain,
      });
    }

    const { token, addr, market, feed } = det;
    const { overallScore, riskFlags } = buildScore(det);

    let verdict: string;
    let verdictColor: string;
    if (overallScore >= 75) { verdict = 'SAFE'; verdictColor = '#10B981'; }
    else if (overallScore >= 55) { verdict = 'CAUTION'; verdictColor = '#F59E0B'; }
    else if (overallScore >= 35) { verdict = 'WARNING'; verdictColor = '#F97316'; }
    else { verdict = 'DANGER'; verdictColor = '#EF4444'; }

    const dexData = market ? {
      price: market.price,
      priceChange24h: market.priceChange24h,
      volume24h: market.volume24h,
      liquidity: market.liquidity,
      fdv: market.fdv,
      marketCap: market.marketCap,
      imageUrl: market.imageUrl ?? null,
      symbol: market.symbol,
      name: market.name,
      url: market.url,
    } : null;

    const socials = market?.socials ?? feed?.socials ?? null;
    const launchpad = feed?.launchpad
      ? { id: feed.launchpad, label: feed.launchpadLabel }
      : null;
    const ageMsLabel = ageLabel(det.ageMs);

    const tokenSecurity = token ? {
      isHoneypot: token.isHoneypot,
      buyTax: (token.buyTax * 100).toFixed(2) + '%',
      sellTax: (token.sellTax * 100).toFixed(2) + '%',
      isOpenSource: token.isOpenSource,
      isMintable: token.isMintable,
      isProxy: token.isProxy,
      hasHiddenOwner: token.hasHiddenOwner,
      canTakeBackOwnership: token.canTakeBackOwnership,
      ownerCanChangeBalance: token.ownerCanChangeBalance,
      selfDestruct: token.selfDestruct,
      externalCall: token.externalCall,
      cannotBuy: token.cannotBuy,
      cannotSellAll: token.cannotSellAll,
      holderCount: feed?.holders ?? token.holderCount,
      ownerAddress: token.ownerAddress,
      creatorAddress: token.creatorAddress,
      checks: token.checks,
    } : null;

    const addressIntel = addr ? {
      riskLevel: addr.riskLevel,
      riskScore: addr.riskScore,
      isBlacklisted: addr.isBlacklisted,
      isMalicious: addr.isMalicious,
      isPhishing: addr.isPhishing,
      isMixer: addr.isMixer,
      labels: addr.labels,
    } : null;

    // ── TOO EARLY ────────────────────────────────────────────────────────
    // Token exists (security record / fresh pair / feed row) but is brand-new:
    // pair age < ~15 min OR no meaningful liquidity / market yet. Return only
    // the light context we genuinely have — no fabricated report.
    if (det.tooEarly) {
      return NextResponse.json({
        found: true,
        tooEarly: true,
        address: det.address,
        chain: det.chain,
        age: ageMsLabel ?? null,
        ageMs: det.ageMs ?? null,
        launchpad,
        creatorAddress: token?.creatorAddress || null,
        socials,
        dexData,
        // Any early security flags we do have (e.g. mint/freeze authority on a
        // brand-new SPL) so the user still gets a heads-up.
        earlyFlags: riskFlags,
        tokenSecurity,
        analyzedAt: new Date().toISOString(),
      });
    }

    // ── VALID — full report ──────────────────────────────────────────────
    const result: Record<string, unknown> = {
      found: true,
      address: det.address,
      chain: det.chain,
      overallScore,
      verdict,
      verdictColor,
      riskFlags,
      tokenSecurity,
      addressIntel,
      dexData,
      launchpad,
      socials,
      age: ageMsLabel ?? null,
      analyzedAt: new Date().toISOString(),
    };

    // AI verdict (2-3 sentences) — best-effort, non-critical.
    try {
      const tokenInfo = token ? `
Token: ${market?.name || token.raw?.token_name || token.raw?.name || address.slice(0, 10)} (${market?.symbol || token.raw?.token_symbol || token.raw?.symbol || '?'}) | Score: ${overallScore}/100 | ${riskFlags.length} risk flags
Honeypot: ${token.isHoneypot} | Open Source: ${token.isOpenSource} | Mintable: ${token.isMintable}
Buy Tax: ${(token.buyTax * 100).toFixed(1)}% | Sell Tax: ${(token.sellTax * 100).toFixed(1)}%
Holder Count: ${tokenSecurity?.holderCount ?? token.holderCount} | Flags: ${riskFlags.slice(0, 5).join('; ') || 'None'}` : '';
      const marketInfo = market
        ? `\nLiquidity: $${Math.round(market.liquidity).toLocaleString()} | 24h Vol: $${Math.round(market.volume24h).toLocaleString()} | MCap: $${Math.round(market.marketCap).toLocaleString()}${launchpad ? ` | Launchpad: ${launchpad.label}` : ''}`
        : '';
      const addrInfo = addr
        ? `\nAddress Risk: ${addr.riskLevel} | Blacklisted: ${addr.isBlacklisted} | Malicious: ${addr.isMalicious} | Phishing: ${addr.isPhishing}`
        : '';
      const aiText = await vtxAnalyze(
        `Crypto contract analysis — give a concise expert verdict:\n${tokenInfo}${marketInfo}${addrInfo}\n\nReply with:\nASSESSMENT: (2 sentences)\nKEY RISKS: (bullet list or "None detected")\nVERDICT: (SAFE/CAUTION/WARNING/DANGER — one sentence why)`,
        280
      );
      if (aiText) result.aiAnalysis = aiText;
    } catch { /* non-critical */ }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}

// Result-state thresholds (single source: lib/services/contractDetector.ts):
//   INVALID    → bad address format for chain, OR zero data from any source
//   TOO EARLY  → exists but pair age < ~15min OR liquidity < $500 (no real market yet)
//   VALID      → full industry-standard report
