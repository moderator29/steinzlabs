import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { scanTokenSecurity, scanAddress } from '@/lib/security/goplusService';

const CHAIN_MAP: Record<string, string> = {
  ethereum: '1', bsc: '56', polygon: '137', base: '8453',
  avalanche: '43114', arbitrum: '42161', solana: 'solana',
};

const schema = z.object({
  address: z.string().trim().min(1).max(100),
  chain: z.string().trim().default('ethereum'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { address, chain } = parsed.data;

    // Run token security scan (works for contracts)
    const [tokenScan, addressScan] = await Promise.allSettled([
      scanTokenSecurity(address, chain),
      scanAddress(address, chain),
    ]);

    const token = tokenScan.status === 'fulfilled' ? tokenScan.value : null;
    const addr = addressScan.status === 'fulfilled' ? addressScan.value : null;

    // Build comprehensive analysis
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
    }

    if (addr) {
      if (addr.isMalicious) { riskFlags.push('Address flagged as malicious'); overallScore -= 30; }
      if (addr.isPhishing) { riskFlags.push('Phishing activity detected'); overallScore -= 25; }
      if (addr.isMixer) { riskFlags.push('Linked to mixing services'); overallScore -= 15; }
      if (addr.isBlacklisted) { riskFlags.push('Address is blacklisted'); overallScore -= 20; }
    }

    overallScore = Math.max(0, Math.min(100, overallScore));
    let verdict: string;
    let verdictColor: string;
    if (overallScore >= 75) { verdict = 'SAFE'; verdictColor = '#10B981'; }
    else if (overallScore >= 55) { verdict = 'CAUTION'; verdictColor = '#F59E0B'; }
    else if (overallScore >= 35) { verdict = 'WARNING'; verdictColor = '#F97316'; }
    else { verdict = 'DANGER'; verdictColor = '#EF4444'; }

    return NextResponse.json({
      address,
      chain,
      overallScore,
      verdict,
      verdictColor,
      riskFlags,
      tokenSecurity: token ? {
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
        holderCount: token.holderCount,
        ownerAddress: token.ownerAddress,
        creatorAddress: token.creatorAddress,
        checks: token.checks,
      } : null,
      addressIntel: addr ? {
        riskLevel: addr.riskLevel,
        riskScore: addr.riskScore,
        isBlacklisted: addr.isBlacklisted,
        isMalicious: addr.isMalicious,
        isPhishing: addr.isPhishing,
        isMixer: addr.isMixer,
        labels: addr.labels,
      } : null,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Contract analyzer error:', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
