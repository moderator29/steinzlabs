import { NextRequest, NextResponse } from 'next/server';
import { getOptimalQuote } from '@/lib/trading/execution';

export async function POST(request: NextRequest) {
  try {
    const { fromToken, toToken, amount, chain, slippage } = await request.json();

    if (!fromToken || !toToken || !amount || !chain) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const quote = await getOptimalQuote({
      fromToken,
      toToken,
      amount: parseFloat(amount),
      chain,
      slippage: slippage ? parseFloat(slippage) : 0.5,
    });

    return NextResponse.json({ quote });
  } catch (error: any) {
    console.error('Get quote failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get quote' },
      { status: 500 }
    );
  }
}
