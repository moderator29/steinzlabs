import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SWAP_RISK_THRESHOLD, PLATFORM_FEE_BPS } from '@/lib/market/constants';

export const dynamic = 'force-dynamic';

interface ExecuteBody {
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInUSD: number;
  slippage: number;
  walletAddress: string;
  userId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExecuteBody;
    const { chain, tokenIn, tokenOut, amountIn, amountInUSD, slippage, walletAddress, userId } = body;

    if (!chain || !tokenIn || !tokenOut || !amountIn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Security scan on output token
    const security = await getTokenSecurity(tokenOut, chain);
    const riskScore = (security as any)?.riskScore ?? 0;

    if (riskScore > SWAP_RISK_THRESHOLD) {
      return NextResponse.json({
        blocked: true,
        blockReason: `Token failed security scan (Risk Score: ${riskScore}/100)`,
        riskScore,
      }, { status: 200 });
    }

    // Calculate platform fee (0.2%)
    const feeUSD = amountInUSD * (PLATFORM_FEE_BPS / 10000);

    // Log swap attempt to Supabase
    const db = getSupabaseAdmin();
    await (db.from('swap_logs').insert({
      user_id: userId ?? null,
      chain,
      input_token: tokenIn,
      output_token: tokenOut,
      input_amount: parseFloat(amountIn),
      status: 'pending',
    }) as any).catch?.(() => {});

    // Return swap data for client-side execution
    // Actual swap is executed client-side via wallet
    return NextResponse.json({
      success: true,
      riskScore,
      feeUSD,
      feePercent: PLATFORM_FEE_BPS / 100,
      treasuryWallet: process.env.TREASURY_WALLET_ADDRESS ?? '',
      slippage,
      walletAddress,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
