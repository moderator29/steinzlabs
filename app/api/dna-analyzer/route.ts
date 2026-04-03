import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const { walletAddress, holdings, totalBalance } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const holdingsText = holdings && holdings.length > 0
      ? holdings.map((h: any) => `${h.symbol}: $${h.valueUsd} (${h.balance})`).join(', ')
      : 'No on-chain holdings detected';

    const prompt = `You are a professional crypto trading DNA analyst for the STEINZ LABS platform. Analyze this trader's wallet and provide a comprehensive Trading DNA profile.

Wallet: ${walletAddress}
Total Balance: $${totalBalance || 0}
Holdings: ${holdingsText}

Provide a detailed JSON response with this exact structure:
{
  "tradingStyle": "Scalper" | "Swing Trader" | "HODLer" | "DeFi Farmer" | "NFT Flipper" | "Degen",
  "riskProfile": "Conservative" | "Moderate" | "Aggressive" | "Ultra Aggressive",
  "overallScore": 0-100,
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "metrics": {
    "diversification": 0-100,
    "timing": 0-100,
    "riskManagement": 0-100,
    "consistency": 0-100,
    "conviction": 0-100
  },
  "recommendations": ["recommendation1", "recommendation2", "recommendation3", "recommendation4"],
  "personalityTraits": ["trait1", "trait2", "trait3"],
  "marketOutlook": "Brief 1-2 sentence outlook based on their positioning",
  "portfolioGrade": "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F",
  "topInsight": "One key actionable insight for this trader"
}

Be specific, data-driven, and constructive. Base the analysis on the wallet composition, balance size, and token diversity. Return ONLY valid JSON, no markdown.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

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
    console.error('DNA Analyzer error:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
