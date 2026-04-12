import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenSecurity } from '@/lib/services/goplus';
import type { TokenSecurityResult } from '@/lib/security/goplusService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenRiskResult {
  contractAddress: string;
  symbol: string;
  riskLevel: 'safe' | 'warning' | 'danger' | 'unknown';
  score: number;
  flags: string[];
  details: {
    isHoneypot: boolean;
    isMintable: boolean;
    isProxy: boolean;
    isBlacklisted: boolean;
    selfDestruct: boolean;
    hiddenOwner: boolean;
    buyTax: number | null;
    sellTax: number | null;
    holderCount: number | null;
    top10HolderPercent: number | null;
    lpLockedPercent: number | null;
    creatorPercent: number | null;
  };
}

// ─── Mapping helper ───────────────────────────────────────────────────────────

function mapToTokenRiskResult(contractAddress: string, sec: TokenSecurityResult): TokenRiskResult {
  const flags: string[] = sec.checks.filter(c => c.status === 'fail').map(c => c.label);
  let deductions = 0;

  if (sec.isHoneypot)          { flags.push('Honeypot detected');             deductions += 80; }
  if (sec.hasHiddenOwner)      { flags.push('Hidden owner');                  deductions += 40; }
  if (sec.isMintable)          { flags.push('Mintable supply');               deductions += 20; }
  if (sec.canTakeBackOwnership){ flags.push('Owner can reclaim ownership');   deductions += 30; }
  if (sec.ownerCanChangeBalance){ flags.push('Owner can change balances');    deductions += 50; }

  const buyTaxPct = sec.buyTax > 0 ? sec.buyTax * 100 : null;
  const sellTaxPct = sec.sellTax > 0 ? sec.sellTax * 100 : null;
  if (buyTaxPct !== null && buyTaxPct > 10) { flags.push(`High buy tax (${buyTaxPct.toFixed(1)}%)`); deductions += Math.min(buyTaxPct * 2, 30); }
  if (sellTaxPct !== null && sellTaxPct > 10) { flags.push(`High sell tax (${sellTaxPct.toFixed(1)}%)`); deductions += Math.min(sellTaxPct * 2, 30); }

  // Extract raw GoPlus fields for extra details
  const raw = sec.raw as Record<string, unknown> | undefined;
  const selfDestruct = raw?.selfdestruct === '1';
  const isBlacklisted = raw?.is_blacklisted === '1';
  const creatorPercent = raw?.creator_percent != null ? parseFloat(String(raw.creator_percent)) * 100 : null;
  const lpHolders = Array.isArray(raw?.lp_holders) ? (raw!.lp_holders as Array<Record<string, unknown>>) : [];
  const lpLockedPercent = lpHolders.reduce((sum, h) => sum + (h.is_locked === 1 ? parseFloat(String(h.percent ?? '0')) * 100 : 0), 0) || null;
  const top10Holders = Array.isArray(raw?.holders) ? (raw!.holders as Array<Record<string, unknown>>) : [];
  const top10HolderPercent = top10Holders.length > 0
    ? top10Holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(String(h.percent ?? '0')), 0) * 100
    : null;

  if (selfDestruct) { flags.push('Self-destruct code'); deductions += 60; }
  if (isBlacklisted) { flags.push('Blacklist function'); deductions += 25; }
  if (creatorPercent !== null && creatorPercent > 20) { flags.push(`Creator holds ${creatorPercent.toFixed(1)}%`); deductions += 10; }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  const riskLevel: TokenRiskResult['riskLevel'] =
    sec.isHoneypot || selfDestruct ? 'danger' :
    score >= 75 ? 'safe' :
    score >= 45 ? 'warning' : 'danger';

  return {
    contractAddress,
    symbol: sec.raw ? String((sec.raw as Record<string, unknown>).token_symbol ?? '') : '',
    riskLevel, score, flags,
    details: {
      isHoneypot: sec.isHoneypot, isMintable: sec.isMintable, isProxy: sec.isProxy,
      isBlacklisted, selfDestruct, hiddenOwner: sec.hasHiddenOwner,
      buyTax: buyTaxPct, sellTax: sellTaxPct,
      holderCount: sec.holderCount > 0 ? sec.holderCount : null,
      top10HolderPercent, lpLockedPercent, creatorPercent,
    },
  };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

interface RequestBody {
  tokens: Array<{ contractAddress: string; symbol?: string }>;
  chainId?: string;
}

// Map Ethereum chain IDs to service-layer chain slugs
const CHAIN_ID_MAP: Record<string, string> = {
  '1': 'ethereum', '8453': 'base', '42161': 'arbitrum',
  '10': 'optimism', '137': 'polygon', '43114': 'avalanche',
  '56': 'bsc',
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as RequestBody;
    const { tokens, chainId = '1' } = body;

    if (!tokens || !Array.isArray(tokens)) {
      return NextResponse.json({ error: 'tokens array required' }, { status: 400 });
    }

    const chain = CHAIN_ID_MAP[chainId] ?? 'ethereum';
    const scannable = tokens
      .filter(t => t.contractAddress && t.contractAddress !== 'native')
      .slice(0, 15);

    const results = await Promise.allSettled(
      scannable.map(t => getTokenSecurity(t.contractAddress, chain))
    );

    const riskResults: Record<string, TokenRiskResult> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const addr = scannable[i].contractAddress.toLowerCase();
        riskResults[addr] = mapToTokenRiskResult(scannable[i].contractAddress, r.value);
      }
    });

    const scanned = Object.values(riskResults);
    const dangerCount = scanned.filter(r => r.riskLevel === 'danger').length;
    const warningCount = scanned.filter(r => r.riskLevel === 'warning').length;
    const avgScore = scanned.length > 0
      ? scanned.reduce((s, r) => s + r.score, 0) / scanned.length
      : 100;

    let portfolioRisk: 'safe' | 'moderate' | 'high' | 'critical';
    if (dangerCount > 0) portfolioRisk = 'critical';
    else if (warningCount >= 3) portfolioRisk = 'high';
    else if (warningCount >= 1 || avgScore < 75) portfolioRisk = 'moderate';
    else portfolioRisk = 'safe';

    return NextResponse.json({
      results: riskResults,
      summary: {
        scanned: scanned.length,
        safe: scanned.filter(r => r.riskLevel === 'safe').length,
        warning: warningCount,
        danger: dangerCount,
        unknown: tokens.length - scanned.length,
        avgScore: Math.round(avgScore),
        portfolioRisk,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Risk scan failed' }, { status: 500 });
  }
}
