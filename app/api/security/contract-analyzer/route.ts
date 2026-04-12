import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenSecurity, getAddressSecurity } from '@/lib/services/goplus';
import { searchPairs } from '@/lib/services/dexscreener';
import { vtxAnalyze } from '@/lib/services/anthropic';

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

    // Run security scans + DEX data in parallel via service layer
    const [tokenScan, addressScan, dexScan] = await Promise.allSettled([
      getTokenSecurity(address, chain),
      getAddressSecurity(address, chain),
      searchPairs(address),
    ]);

    const token = tokenScan.status === 'fulfilled' ? tokenScan.value : null;
    const addr = addressScan.status === 'fulfilled' ? addressScan.value : null;
    const topPair = dexScan.status === 'fulfilled' && dexScan.value.length > 0 ? dexScan.value[0] : null;
    const dexData = topPair ? {
      price: parseFloat(String(topPair.priceUsd ?? '0')),
      priceChange24h: topPair.priceChange?.h24 ?? 0,
      volume24h: topPair.volume?.h24 ?? 0,
      liquidity: topPair.liquidity?.usd ?? 0,
      fdv: topPair.fdv ?? 0,
      marketCap: (topPair as any).marketCap ?? topPair.fdv ?? 0,
      imageUrl: (topPair as any).info?.imageUrl ?? null,
      symbol: topPair.baseToken?.symbol,
      name: topPair.baseToken?.name,
      url: (topPair as any).url ?? null,
    } : null;

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

    const result: Record<string, any> = {
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
      dexData,
      analyzedAt: new Date().toISOString(),
    };

    // AI-powered contract analysis via vtxAnalyze (service layer)
    try {
      const tokenInfo = token ? `
Token: ${token.raw?.token_name || token.raw?.name || address.slice(0, 10)} (${token.raw?.token_symbol || token.raw?.symbol || '?'}) | Score: ${overallScore}/100 | ${riskFlags.length} risk flags
Honeypot: ${token.isHoneypot} | Open Source: ${token.isOpenSource} | Mintable: ${token.isMintable}
Buy Tax: ${(token.buyTax * 100).toFixed(1)}% | Sell Tax: ${(token.sellTax * 100).toFixed(1)}%
Holder Count: ${token.holderCount} | Flags: ${riskFlags.slice(0, 5).join('; ') || 'None'}` : '';
      const addrInfo = addr
        ? `\nAddress Risk: ${addr.riskLevel} | Blacklisted: ${addr.isBlacklisted} | Malicious: ${addr.isMalicious} | Phishing: ${addr.isPhishing}`
        : '';
      const aiText = await vtxAnalyze(
        `Crypto contract analysis — give a concise expert verdict:\n${tokenInfo}${addrInfo}\n\nReply with:\nASSESSMENT: (2 sentences)\nKEY RISKS: (bullet list or "None detected")\nVERDICT: (SAFE/CAUTION/WARNING/DANGER — one sentence why)`,
        280
      );
      if (aiText) result.aiAnalysis = aiText;
    } catch { /* non-critical */ }

    return NextResponse.json(result);
  } catch (err) {

    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
