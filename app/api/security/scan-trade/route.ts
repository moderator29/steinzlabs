import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { shadowGuardian } from '@/lib/security/shadowGuardian';
import { saveScanResult, getUserByWallet } from '@/lib/database/supabase';

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

    if (userWallet) {
      try {
        const user = await getUserByWallet(userWallet);
        if (user) {
          await saveScanResult({
            userId: user.id,
            tokenAddress,
            scanResult,
            allowed: scanResult.allowed,
            blocked: scanResult.blocked,
            riskScore: scanResult.riskScore,
            reason: scanResult.reason,
          });
        }
      } catch (dbError) {

      }
    }

    return NextResponse.json(scanResult);
  } catch (error) {

    return NextResponse.json(
      { error: 'Trade scan failed' },
      { status: 500 }
    );
  }
}
