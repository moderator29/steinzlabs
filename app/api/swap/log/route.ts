import { logger } from '@/lib/logger';
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserByWallet } from '@/lib/database/supabase';
import { recordSwapLog, recordFeeRevenue, PLATFORM_FEE_BPS } from '@/lib/trading/swapLogging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      txHash,
      chain,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      platformFeeBps,
      status,
    } = body as {
      walletAddress: string;
      txHash: string;
      chain: string;
      fromToken: string;
      toToken: string;
      fromAmount: number;
      toAmount: number;
      platformFeeBps?: number;
      status?: string;
    };

    if (!walletAddress || !txHash || !chain || !fromToken || !toToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const feeBps = platformFeeBps || PLATFORM_FEE_BPS;
    const feeUsd = fromAmount * (feeBps / 10000);

    // swap_logs.user_id is NOT NULL; resolve it from the wallet (the client
    // only sends an address here). fee_revenue tolerates a null user_id.
    const user = await getUserByWallet(walletAddress);
    const userId = user?.id ?? null;

    await recordSwapLog(db, {
      user_id: userId,
      token_in: fromToken,
      token_out: toToken,
      amount_in: fromAmount,
      amount_out: toAmount,
      fee_usd: feeUsd,
      chain,
      status: status === 'failed' ? 'failed' : 'confirmed',
      tx_hash: txHash,
    });

    await recordFeeRevenue(db, {
      user_id: userId,
      tx_hash: txHash,
      fee_amount: fromAmount * (feeBps / 10000),
      fee_token: fromToken,
      usd_value: feeUsd,
      chain,
    });

    return NextResponse.json({ success: true, feeUsd });
  } catch (error) {
    logger.error({ err: error }, '[Swap Log] Unexpected error:');
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Failed to log swap' }, { status: 500 });
  }
}
