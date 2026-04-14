import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getSwapQuote, getChainId } from '@/lib/services/zerox';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SWAP_RISK_THRESHOLD } from '@/lib/market/constants';

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

    if (!chain || !tokenIn || !tokenOut || !amountIn || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Security scan on output token
    const security = await getTokenSecurity(tokenOut, chain).catch(() => null);
    const riskScore = (security as Record<string, unknown>)?.riskScore as number ?? 0;

    if (riskScore > SWAP_RISK_THRESHOLD) {
      return NextResponse.json({
        blocked: true,
        blockReason: `Token failed security scan (Risk Score: ${riskScore}/100)`,
        riskScore,
      }, { status: 200 });
    }

    // Step 2: Get 0x swap quote
    const chainId = getChainId(chain);
    if (!chainId) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
    }

    const quote = await getSwapQuote({
      chainId,
      sellToken: tokenIn,
      buyToken: tokenOut,
      sellAmount: amountIn,
      taker: walletAddress,
    });

    // Platform fee is included via feeRecipient in zerox.ts
    const feePercent = 0.4;
    const feeUSD = amountInUSD * 0.004;

    // Log swap attempt to Supabase
    const db = getSupabaseAdmin();
    await db.from('swap_logs').insert({
      user_id: userId ?? null,
      chain,
      input_token: tokenIn,
      output_token: tokenOut,
      input_amount: parseFloat(amountIn),
      status: 'pending',
    }).then(() => {}).catch(() => {});

    return NextResponse.json({
      success: true,
      riskScore,
      feeUSD,
      feePercent,
      transaction: quote.transaction,
      allowanceTarget: quote.allowanceTarget,
      buyAmount: quote.buyAmount,
      gas: quote.gas,
      route: quote.route,
      fees: quote.fees,
      slippage,
      walletAddress,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Trade execution failed' }, { status: 500 });
  }
}
