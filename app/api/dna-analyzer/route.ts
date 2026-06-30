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

const ADDRESS_RE = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;

function sanitizeNumeric(n: unknown): string {
  const v = typeof n === 'number' ? n : parseFloat(String(n ?? '0'));
  if (!Number.isFinite(v) || v < 0) return '0';
  return Math.min(v, 1e15).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Grounded portfolio score from REAL holdings — a transparent code formula, not
 * an LLM guess. Diversification (HHI over holding USD values) + holdings breadth
 * + whether the wallet is active. Replaces the previously LLM-invented
 * overallScore/grade/metrics that varied run-to-run with no rubric.
 */
function computeGrounded(
  holdings: Array<{ valueUsd: string | number }> | undefined,
  txCount: number | undefined,
): { diversification: number; score: number; grade: string } {
  const vals = (holdings ?? []).map(h => Number(h.valueUsd) || 0).filter(v => v > 0);
  const total = vals.reduce((s, v) => s + v, 0);
  const hhi = total > 0 ? vals.reduce((s, v) => s + (v / total) ** 2, 0) : 1;
  const diversification = Math.max(0, Math.min(100, Math.round((1 - hhi) * 100)));
  const breadth = Math.min(100, (holdings?.length ?? 0) * 10);
  const active = (Number(txCount) || 0) > 0 ? 100 : 0;
  const score = Math.round(0.6 * diversification + 0.2 * breadth + 0.2 * active);
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B'
    : score >= 50 ? 'C+' : score >= 40 ? 'C' : score >= 30 ? 'D' : 'F';
  return { diversification, score, grade };
}

// withTierGate('mini') — DNA analysis calls Sonnet 4.6 (billable);
// the route had zero auth or rate-limit so a script could iterate
// addresses and burn $150-300/day in Anthropic spend. Pro+ only now.
export const POST = withTierGate('mini', async (request: NextRequest) => {
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

    const prompt = `You are a senior crypto intelligence analyst for NAKA LABS — a professional on-chain analytics platform. Analyze this wallet from the data below ONLY.

Wallet: ${walletAddress}
Total Portfolio Value: $${safeTotalBalance}
Holdings: ${holdingsText}
Transaction Count: ${safeTxCount}

STRICT GROUNDING: Never invent numbers, prices, PnL, win rates, entry/exit timing, or per-trade outcomes that are not given above. If something is unknown, say "unknown" — do not estimate it. Qualitative judgments (style, strengths, risks) are allowed but must be justified by the holdings/activity shown. Do NOT output any numeric scores — those are computed separately.

Provide a JSON response with this EXACT structure (no other fields). All text fields must be specific sentences grounded in the data — not placeholders:
{
  "tradingStyle": "Scalper" | "Swing Trader" | "HODLer" | "DeFi Farmer" | "NFT Flipper" | "Degen" | "Arbitrageur" | "Yield Farmer",
  "riskProfile": "Conservative" | "Moderate" | "Aggressive" | "Ultra Aggressive",
  "topInsight": "<2-3 sentence key insight grounded in the holdings/activity above>",
  "marketOutlook": "<2-3 sentence qualitative assessment — no invented price targets>",
  "riskAssessment": {
    "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
    "summary": "<3-4 sentence paragraph assessing risk from the holdings shown>",
    "keyRisks": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"]
  },
  "activityPattern": {
    "classification": "<e.g. 'High-Frequency Trader', 'Long-Term Accumulator'>",
    "summary": "<3-4 sentence paragraph about activity (use 'unknown' if tx detail is thin)>",
    "estimatedFrequency": "<e.g. 'Daily active', 'Weekly trades', or 'unknown'>"
  },
  "notableBehaviors": [
    { "behavior": "<behavior title>", "detail": "<2 sentence explanation grounded in holdings>" },
    { "behavior": "<behavior title>", "detail": "<2 sentence explanation grounded in holdings>" }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"],
  "personalityTraits": ["<trait 1>", "<trait 2>", "<trait 3>"]
}
Return ONLY valid JSON.`;

    const grounded = computeGrounded(holdings, txCount);
    const responseText = await vtxAnalyze(prompt, 2048);
    if (!responseText) {
      // Fail GRACEFULLY — show the GROUNDED (code-computed) numbers + an honest
      // note instead of a fabricated 'C' grade. The narrative is unavailable but
      // the score/grade/diversification are real.
      return NextResponse.json({
        analysis: {
          tradingStyle: 'Unknown',
          riskProfile: 'Moderate',
          overallScore: grounded.score,
          portfolioGrade: grounded.grade,
          metrics: { diversification: grounded.diversification },
          topInsight: 'AI narrative unavailable — showing on-chain-derived metrics only.',
          marketOutlook: 'unknown',
          note: 'AI narrative unavailable — using on-chain data only.',
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

    // Numbers come from CODE (grounded), narrative from the LLM. Overwrite any
    // model-supplied score/grade/metrics so the UI can never show an invented one.
    const merged = {
      ...(analysis as Record<string, unknown>),
      overallScore: grounded.score,
      portfolioGrade: grounded.grade,
      metrics: { diversification: grounded.diversification },
    };

    return NextResponse.json({ analysis: merged, wallet: walletAddress });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
