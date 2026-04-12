import 'server-only';
import { NextResponse } from 'next/server';
import { vtxAnalyze } from '@/lib/services/anthropic';

export async function POST(request: Request) {
  try {
    const { walletAddress, holdings, totalBalance, txCount } = await request.json() as {
      walletAddress?: string;
      holdings?: Array<{ symbol: string; valueUsd: string | number; balance: string | number }>;
      totalBalance?: number;
      txCount?: number;
    };

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const holdingsText = holdings && holdings.length > 0
      ? holdings.map(h => `${h.symbol}: $${h.valueUsd} (${h.balance})`).join(', ')
      : 'No on-chain holdings detected';

    const prompt = `You are a senior crypto intelligence analyst for STEINZ LABS — a professional on-chain analytics platform. Analyze this wallet comprehensively and produce a detailed intelligence report.

Wallet: ${walletAddress}
Total Portfolio Value: $${totalBalance || 0}
Holdings: ${holdingsText}
Transaction Count: ${txCount || 'unknown'}

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
    if (!responseText) throw new Error('AI analysis unavailable');

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
}
