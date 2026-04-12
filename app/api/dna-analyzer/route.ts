import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.CLAUDE_KEY || process.env.ANTHROPIC_KEY,
});

export async function POST(request: Request) {
  try {
    const { walletAddress, holdings, totalBalance, txCount } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const holdingsText = holdings && holdings.length > 0
      ? holdings.map((h: any) => `${h.symbol}: $${h.valueUsd} (${h.balance})`).join(', ')
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
    "summary": "<3-4 sentence paragraph assessing the overall risk level of this wallet — cover concentration risk, asset quality, behavioral risk>",
    "keyRisks": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"]
  },

  "activityPattern": {
    "classification": "<e.g. 'High-Frequency Trader', 'Long-Term Accumulator', 'Occasional Participant', 'Bot-Assisted Trader'>",
    "summary": "<3-4 sentence paragraph about transaction patterns, timing behavior, frequency, chain preference and what it suggests about the user>",
    "estimatedFrequency": "<e.g. 'Daily active', 'Weekly trades', 'Monthly movements'>",
    "primaryChains": ["<chain1>", "<chain2>"]
  },

  "notableBehaviors": [
    {
      "behavior": "<behavior title>",
      "detail": "<2 sentence explanation of this notable on-chain behavior pattern>"
    },
    {
      "behavior": "<behavior title>",
      "detail": "<2 sentence explanation>"
    },
    {
      "behavior": "<behavior title>",
      "detail": "<2 sentence explanation>"
    }
  ],

  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>", "<specific strength 4>"],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", "<specific weakness 3>"],

  "recommendations": [
    "<actionable recommendation 1 — be specific>",
    "<actionable recommendation 2>",
    "<actionable recommendation 3>",
    "<actionable recommendation 4>",
    "<actionable recommendation 5>"
  ],

  "metrics": {
    "diversification": <0-100>,
    "timing": <0-100>,
    "riskManagement": <0-100>,
    "consistency": <0-100>,
    "conviction": <0-100>
  },

  "personalityTraits": ["<trait 1>", "<trait 2>", "<trait 3>"]
}

Rules:
- Be specific and data-driven. Reference actual holdings and values when possible.
- All paragraph fields must be 2-4 real sentences, not filler.
- riskScore and overallScore must be actual integers.
- Return ONLY valid JSON. No markdown, no explanation outside JSON.`;

    const MODELS = ['claude-sonnet-4-6', 'claude-3-5-sonnet-20241022'];
    let aiMessage: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
    for (const model of MODELS) {
      try {
        aiMessage = await anthropic.messages.create({
          model,
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (err: any) {
        // model failed, try next
      }
    }
    if (!aiMessage) throw new Error('AI analysis unavailable');

    const responseText = aiMessage.content[0].type === 'text' ? aiMessage.content[0].text : '';

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
  } catch (error: any) {

    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
