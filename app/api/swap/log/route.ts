import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const PLATFORM_FEE_BPS = 40; // 0.4% — canonical fee rate

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
      swapType,
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
      swapType?: string;
      status?: string;
    };

    if (!walletAddress || !txHash || !chain || !fromToken || !toToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const feeBps = platformFeeBps || PLATFORM_FEE_BPS;
    const feeUsd = fromAmount * (feeBps / 10000);

    // Log the swap transaction
    const { error: swapError } = await db.from('swap_logs').insert({
      wallet_address: walletAddress,
      chain,
      input_token: fromToken,
      output_token: toToken,
      input_amount: fromAmount,
      output_amount: toAmount,
      status: status || 'confirmed',
      tx_hash: txHash,
      swap_type: swapType || 'standard',
      created_at: new Date().toISOString(),
    });

    if (swapError) {
      console.error('[Swap Log] swap_logs insert failed:', swapError.message);
    }

    // Log platform fee revenue
    const { error: feeError } = await db.from('fee_revenue').insert({
      wallet_address: walletAddress,
      tx_hash: txHash,
      chain,
      fee_usd: feeUsd,
      fee_bps: feeBps,
      input_token: fromToken,
      output_token: toToken,
      input_value_usd: fromAmount,
      created_at: new Date().toISOString(),
    });

    if (feeError) {
      console.error('[Swap Log] fee_revenue insert failed:', feeError.message);
    }

    return NextResponse.json({ success: true, feeUsd });
  } catch (error) {
    console.error('[Swap Log] Unexpected error:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Failed to log swap' }, { status: 500 });
  }
}
