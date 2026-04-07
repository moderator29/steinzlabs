import { NextResponse } from 'next/server';

// GoPlus Security API - hidden from frontend, never expose "GoPlus" in UI responses
const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';

export interface TokenRiskResult {
  contractAddress: string;
  symbol: string;
  riskLevel: 'safe' | 'warning' | 'danger' | 'unknown';
  score: number; // 0-100, higher = safer
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

async function scanToken(contractAddress: string, chainId = '1'): Promise<TokenRiskResult | null> {
  if (!contractAddress || contractAddress === 'native') return null;

  try {
    const res = await fetch(
      `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${contractAddress}`,
      {
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 300 }, // cache 5 min
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.result?.[contractAddress.toLowerCase()];
    if (!result) return null;

    const flags: string[] = [];
    let deductions = 0;

    const isHoneypot = result.is_honeypot === '1';
    const isMintable = result.is_mintable === '1';
    const isProxy = result.is_proxy === '1';
    const isBlacklisted = result.is_blacklisted === '1';
    const selfDestruct = result.selfdestruct === '1';
    const hiddenOwner = result.hidden_owner === '1';
    const cannotBuy = result.cannot_buy === '1';
    const cannotSellAll = result.cannot_sell_all === '1';
    const tradingCooldown = result.trading_cooldown === '1';
    const transferPausable = result.transfer_pausable === '1';
    const isAntiWhale = result.is_anti_whale === '1';

    const buyTax = result.buy_tax != null ? parseFloat(result.buy_tax) * 100 : null;
    const sellTax = result.sell_tax != null ? parseFloat(result.sell_tax) * 100 : null;
    const holderCount = result.holder_count ? parseInt(result.holder_count) : null;
    const top10HolderPercent = result.top_10_holders_percent != null
      ? parseFloat(result.top_10_holders_percent) * 100
      : null;
    const lpLockedPercent = result.lp_holders?.reduce((sum: number, h: any) => {
      return sum + (h.is_locked === 1 ? parseFloat(h.percent || '0') * 100 : 0);
    }, 0) ?? null;
    const creatorPercent = result.creator_percent != null
      ? parseFloat(result.creator_percent) * 100
      : null;

    if (isHoneypot) { flags.push('Honeypot detected'); deductions += 80; }
    if (selfDestruct) { flags.push('Self-destruct code'); deductions += 60; }
    if (hiddenOwner) { flags.push('Hidden owner'); deductions += 40; }
    if (cannotBuy) { flags.push('Cannot buy'); deductions += 50; }
    if (cannotSellAll) { flags.push('Cannot sell all tokens'); deductions += 40; }
    if (isMintable) { flags.push('Mintable supply'); deductions += 20; }
    if (isBlacklisted) { flags.push('Blacklist function'); deductions += 25; }
    if (tradingCooldown) { flags.push('Trading cooldown'); deductions += 15; }
    if (transferPausable) { flags.push('Transfers pausable'); deductions += 20; }
    if (isAntiWhale) { flags.push('Anti-whale mechanism'); deductions += 5; }
    if (buyTax !== null && buyTax > 10) { flags.push(`High buy tax (${buyTax.toFixed(1)}%)`); deductions += Math.min(buyTax * 2, 30); }
    if (sellTax !== null && sellTax > 10) { flags.push(`High sell tax (${sellTax.toFixed(1)}%)`); deductions += Math.min(sellTax * 2, 30); }
    if (top10HolderPercent !== null && top10HolderPercent > 80) { flags.push(`Concentrated supply (top 10: ${top10HolderPercent.toFixed(0)}%)`); deductions += 15; }
    if (creatorPercent !== null && creatorPercent > 20) { flags.push(`Creator holds ${creatorPercent.toFixed(1)}%`); deductions += 10; }

    const score = Math.max(0, Math.min(100, 100 - deductions));

    let riskLevel: TokenRiskResult['riskLevel'];
    if (isHoneypot || selfDestruct || cannotBuy || cannotSellAll) {
      riskLevel = 'danger';
    } else if (score >= 75) {
      riskLevel = 'safe';
    } else if (score >= 45) {
      riskLevel = 'warning';
    } else {
      riskLevel = 'danger';
    }

    return {
      contractAddress,
      symbol: result.token_symbol || '',
      riskLevel,
      score,
      flags,
      details: {
        isHoneypot,
        isMintable,
        isProxy,
        isBlacklisted,
        selfDestruct,
        hiddenOwner,
        buyTax,
        sellTax,
        holderCount,
        top10HolderPercent,
        lpLockedPercent,
        creatorPercent,
      },
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { tokens, chainId = '1' } = await request.json();

    if (!tokens || !Array.isArray(tokens)) {
      return NextResponse.json({ error: 'tokens array required' }, { status: 400 });
    }

    // Filter out native tokens and scan up to 15 at once
    const scannable = tokens
      .filter((t: any) => t.contractAddress && t.contractAddress !== 'native')
      .slice(0, 15);

    const results = await Promise.allSettled(
      scannable.map((t: any) => scanToken(t.contractAddress, chainId))
    );

    const riskResults: Record<string, TokenRiskResult> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        riskResults[scannable[i].contractAddress.toLowerCase()] = r.value;
      }
    });

    // Compute portfolio risk summary
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
  } catch (error: any) {
    console.error('Portfolio risk scan error:', error);
    return NextResponse.json({ error: 'Risk scan failed' }, { status: 500 });
  }
}
