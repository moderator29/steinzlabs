import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { z } from 'zod';

const schema = z.object({
  address: z.string().trim().min(1).max(100),
  chain: z.string().trim().default('ethereum'),
  overallScore: z.number(),
  riskFlags: z.array(z.string()),
  tokenSecurity: z.object({
    isHoneypot: z.boolean(),
    buyTax: z.string(),
    sellTax: z.string(),
    isOpenSource: z.boolean(),
    isMintable: z.boolean(),
    hasHiddenOwner: z.boolean(),
    canTakeBackOwnership: z.boolean(),
    ownerCanChangeBalance: z.boolean(),
    selfDestruct: z.boolean(),
    holderCount: z.number(),
  }).nullable(),
  addressIntel: z.object({
    riskLevel: z.string(),
    riskScore: z.number(),
    isMalicious: z.boolean(),
    isPhishing: z.boolean(),
    labels: z.array(z.string()),
  }).nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { address, chain, overallScore, riskFlags, tokenSecurity, addressIntel } = parsed.data;

    const secCtx = [
      `Token Address: ${address}`,
      `Chain: ${chain}`,
      `Security Score: ${overallScore}/100`,
      `Risk Flags: ${riskFlags.length > 0 ? riskFlags.join(', ') : 'None'}`,
      tokenSecurity ? [
        'Token Security:',
        `- Honeypot: ${tokenSecurity.isHoneypot ? 'YES (CRITICAL)' : 'No'}`,
        `- Buy Tax: ${tokenSecurity.buyTax}`,
        `- Sell Tax: ${tokenSecurity.sellTax}`,
        `- Open Source: ${tokenSecurity.isOpenSource ? 'Yes' : 'No (RISK)'}`,
        `- Mintable: ${tokenSecurity.isMintable ? 'Yes (RISK)' : 'No'}`,
        `- Hidden Owner: ${tokenSecurity.hasHiddenOwner ? 'Yes (RISK)' : 'No'}`,
        `- Can Take Back Ownership: ${tokenSecurity.canTakeBackOwnership ? 'Yes (RISK)' : 'No'}`,
        `- Owner Can Change Balances: ${tokenSecurity.ownerCanChangeBalance ? 'Yes (CRITICAL RISK)' : 'No'}`,
        `- Self Destruct: ${tokenSecurity.selfDestruct ? 'Yes (RISK)' : 'No'}`,
        `- Holder Count: ${tokenSecurity.holderCount}`,
      ].join('\n') : 'Token security data unavailable.',
      addressIntel ? [
        'Address Intelligence:',
        `- Risk Level: ${addressIntel.riskLevel}`,
        `- Risk Score: ${addressIntel.riskScore}/100`,
        `- Malicious: ${addressIntel.isMalicious ? 'YES' : 'No'}`,
        `- Phishing: ${addressIntel.isPhishing ? 'YES' : 'No'}`,
        `- Known Labels: ${addressIntel.labels.length > 0 ? addressIntel.labels.join(', ') : 'None'}`,
      ].join('\n') : 'Address intelligence unavailable.',
    ].join('\n');

    const prompt = `You are a senior DeFi security analyst at STEINZ LABS. Analyze this token contract security data and provide a clear, honest risk assessment for retail investors.

${secCtx}

Respond with valid JSON only. No markdown, no code blocks, just raw JSON:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "riskColor": "#10B981" | "#F59E0B" | "#F97316" | "#EF4444",
  "summary": "<3-4 sentence paragraph in plain English explaining the overall risk situation>",
  "warnings": [{"title": "<title>", "description": "<1-2 sentences>", "severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"}],
  "positives": ["<one positive security attribute, if any>"],
  "verdict": "<single sentence investor verdict>"
}`;

    const text = await vtxAnalyze(prompt, 1000);
    if (!text) throw new Error('AI assessment unavailable');

    const match = text.match(/\{[\s\S]*\}/);
    const assessment = JSON.parse(match ? match[0] : text);

    return NextResponse.json(assessment);
  } catch {
    return NextResponse.json({ error: 'AI assessment failed' }, { status: 500 });
  }
}
