import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const anthropic = new Anthropic();

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

    const securityContext = `
Token Address: ${address}
Chain: ${chain}
Security Score: ${overallScore}/100
Risk Flags: ${riskFlags.length > 0 ? riskFlags.join(', ') : 'None'}
${tokenSecurity ? `
Token Security:
- Honeypot: ${tokenSecurity.isHoneypot ? 'YES (CRITICAL)' : 'No'}
- Buy Tax: ${tokenSecurity.buyTax}
- Sell Tax: ${tokenSecurity.sellTax}
- Open Source: ${tokenSecurity.isOpenSource ? 'Yes' : 'No (RISK)'}
- Mintable: ${tokenSecurity.isMintable ? 'Yes (RISK)' : 'No'}
- Hidden Owner: ${tokenSecurity.hasHiddenOwner ? 'Yes (RISK)' : 'No'}
- Can Take Back Ownership: ${tokenSecurity.canTakeBackOwnership ? 'Yes (RISK)' : 'No'}
- Owner Can Change Balances: ${tokenSecurity.ownerCanChangeBalance ? 'Yes (CRITICAL RISK)' : 'No'}
- Self Destruct: ${tokenSecurity.selfDestruct ? 'Yes (RISK)' : 'No'}
- Holder Count: ${tokenSecurity.holderCount}
` : 'Token security data unavailable.'}
${addressIntel ? `
Address Intelligence:
- Risk Level: ${addressIntel.riskLevel}
- Risk Score: ${addressIntel.riskScore}/100
- Malicious: ${addressIntel.isMalicious ? 'YES' : 'No'}
- Phishing: ${addressIntel.isPhishing ? 'YES' : 'No'}
- Known Labels: ${addressIntel.labels.length > 0 ? addressIntel.labels.join(', ') : 'None'}
` : 'Address intelligence unavailable.'}
`;

    const prompt = `You are a senior DeFi security analyst at STEINZ LABS. Analyze this token contract security data and provide a clear, honest risk assessment for retail investors.

${securityContext}

Respond with valid JSON only. No markdown, no code blocks, just raw JSON:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "riskColor": "#10B981" | "#F59E0B" | "#F97316" | "#EF4444",
  "summary": "<3-4 sentence paragraph in plain English explaining the overall risk situation, what the security score means, and whether this token appears safe to interact with. Be direct and specific.>",
  "warnings": [
    {
      "title": "<short warning title>",
      "description": "<1-2 sentences explaining what this means for an investor in plain English, and what the risk is>",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    }
  ],
  "positives": [
    "<one positive security attribute, if any>"
  ],
  "verdict": "<single sentence investor verdict — e.g. 'Approach with extreme caution' or 'Appears safe but always DYOR'>"
}`;

    const MODELS = ['claude-sonnet-4-6', 'claude-3-5-sonnet-20241022'];
    let aiResponse: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
    for (const model of MODELS) {
      try {
        aiResponse = await anthropic.messages.create({
          model,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (err: any) {
        console.error(`Contract AI model ${model} failed:`, err?.message || err);
      }
    }
    if (!aiResponse) throw new Error('AI assessment unavailable');

    const text = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
    const assessment = JSON.parse(text);

    return NextResponse.json(assessment);
  } catch (err) {

    return NextResponse.json({ error: 'AI assessment failed' }, { status: 500 });
  }
}
