import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { shadowGuardian } from '@/lib/security/shadowGuardian';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const scanTradeSchema = z.object({
  tokenAddress: z.string().trim().min(1).max(100),
  amount: z.number().positive().finite().optional().default(0),
  userWallet: z.string().trim().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scanTradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tokenAddress, amount, userWallet } = parsed.data;

    const scanResult = await shadowGuardian.scanTrade(
      tokenAddress,
      amount,
      userWallet
    );

    // Log scan result to Supabase — non-critical
    if (userWallet) {
      const admin = getSupabaseAdmin();
      admin.from('scans').insert({ user_wallet: userWallet, token_address: tokenAddress, scan_result: scanResult, allowed: scanResult.allowed, blocked: scanResult.blocked, risk_score: scanResult.riskScore, reason: scanResult.reason }).then(() => {}).catch(() => {});
    }

    return NextResponse.json(scanResult);
  } catch (error) {

    return NextResponse.json(
      { error: 'Trade scan failed' },
      { status: 500 }
    );
  }
}
