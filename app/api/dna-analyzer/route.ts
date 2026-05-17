import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
import { vtxAnalyze } from '@/lib/services/anthropic';

// Prompt-injection guard — token symbols come from on-chain metadata
// that a malicious deployer can craft to break the system-prompt
// boundary (e.g. `}\n\nIgnore prior instructions...`).
function sanitizeSymbol(s: unknown, maxLen = 16): string {
  if (typeof s !== 'string') return '';
  return s.replace(/[ -]/g, ' ').replace(/[\r\n\t"\\}]/g, ' ').trim().slice(0, maxLen);
}

// Accepts EVM 0x… 40-hex or Solana base58 32-44 char addresses. Used as a
// gate before we forward an address into a billable Anthropic prompt.
const ADDRESS_RE = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;

// Numeric coercion for prompt-injection-safe rendering. Caps the value so
// a crafted huge number can't blow up the prompt budget.
function sanitizeNumeric(n: unknown): string {
  const v = typeof n === 'number' ? n : parseFloat(String(n ?? '0'));
  if (!Number.isFinite(v) || v < 0) return '0';
  return Math.min(v, 1e15).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// withTierGate('pro') — DNA analysis calls Sonnet 4.6 (billable);
// the route had zero auth or rate-limit so a script could iterate
// addresses and burn $150-300/day in Anthropic spend. Pro+ only now.
export const POST = withTierGate('pro', async (request: NextRequest) => {
  try {
    const { walletAddress, holdings, totalBalance, txCount } = await request.json() as {
      walletAddress?: string;
      holdings?: Array<{ symbol: string; valueUsd: string | number; balance: string | number }>;
      totalBalance?: number;
      txCount?: number;
    };

    if (!walletAddress || !ADDRESS_RE.test(walletAddress)) {
      return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
    }

    const holdingsText = holdings && holdings.length > 0
      ? holdings
          .map((h) => `${sanitizeSymbol(h.symbol)}: $${Number(h.valueUsd) || 0} (${Number(h.balance) || 0})`)
          .join(', ')
      : 'No on-chain holdings detected';
    const safeTotalBalance = sanitizeNumeric(totalBalance);
    const safeTxCount = Number.isFinite(txCount as number)
      ? Math.max(0, Math.min(10_000_000, Math.floor(txCount as number))).toString()
      : 'unknown';

    const prompt = `You are a senior crypto intelligence analyst for NAKA LABS — a professional on-chain analytics platform. Analyze this wallet comprehensively and produce a detailed intelligence report.

Wallet: ${walletAddress}
Total Portfolio Value: $${safeTotalBalance}
Holdings: ${holdingsText}
Transaction Count: ${safeTxCount}

Provide a detailed JSON response with this EXACT structure. All text fields must be detailed, specific sentences — not placeholders:
{
  "tradingStyle": "Scalper" | "Swing Trader" | "HODLer" | "DeFi Farmer" | "NFT Flipper" | "Degen" | "Arbitrageur" | "Yield Farmer",
  "riskProfile": "Conservative" | "Moderate" | "Aggressive" | "Ultra Aggressive",
  "overallScore": <number 0-100>,
  "portfolioGrade": "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D" | "F",
  "topInsight": "<2-3 sentence key insight about this wallet's most notable behavior or risk>",
  "marketOutlook": "<2-3 sentence assessment of their market positioning and expected near-term behavior>",
  "riskAssessment": {
    "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
    "riskScore": <number 0-100, higher = more risky>,
    "summary": "<3-4 sentence paragraph assessing the overall risk level>",
    "keyRisks": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"]
  },
  "activityPattern": {
    "classification": "<e.g. 'High-Frequency Trader', 'Long-Term Accumulator'>",
    "summary": "<3-4 sentence paragraph about transaction patterns>",
    "estimatedFrequency": "<e.g. 'Daily active', 'Weekly trades'>",
    "primaryChains": ["<chain1>", "<chain2>"]
  },
  "notableBehaviors": [
    { "behavior": "<behavior title>", "detail": "<2 sentence explanation>" },
    { "behavior": "<behavior title>", "detail": "<2 sentence explanation>" },
    { "behavior": "<behavior title>", "detail": "<2 sentence explanation>" }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>", "<rec 4>", "<rec 5>"],
  "metrics": {
    "diversification": <0-100>,
    "timing": <0-100>,
    "riskManagement": <0-100>,
    "consistency": <0-100>,
    "conviction": <0-100>
  },
  "personalityTraits": ["<trait 1>", "<trait 2>", "<trait 3>"]
}
Rules: Be specific and data-driven. Reference actual holdings when possible. Return ONLY valid JSON.`;

    const responseText = await vtxAnalyze(prompt, 2048);
    if (!responseText) {
      // Stub fallback — fail GRACEFULLY instead of throwing. Frontend
      // shows a "AI analysis unavailable" notice over an on-chain-only
      // summary instead of a generic 500.
      return NextResponse.json({
        analysis: {
          tradingStyle: 'Unknown',
          riskProfile: 'Moderate',
          overallScore: 0,
          portfolioGrade: 'C',
          topInsight: 'AI analysis unavailable — using on-chain data only.',
          marketOutlook: 'Insufficient data for AI synthesis at this time.',
          note: 'AI analysis unavailable — using on-chain data only.',
        },
        wallet: walletAddress,
        degraded: true,
      });
    }

    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response');
      }
    }

    return NextResponse.json({ analysis, wallet: walletAddress });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
