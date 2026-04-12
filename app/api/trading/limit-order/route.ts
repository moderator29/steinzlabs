import { NextRequest, NextResponse } from 'next/server';
import { createLimitOrder } from '@/lib/trading/advancedOrders';
import { getUserByWallet } from '@/lib/database/supabase';

export async function POST(request: NextRequest) {
  try {
    const params = await request.json();

    // Get user
    const user = await getUserByWallet(params.userWallet);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const order = await createLimitOrder({
      userId: user.id,
      tokenAddress: params.tokenAddress,
      tokenSymbol: params.tokenSymbol,
      chain: params.chain,
      side: params.side,
      targetPrice: params.targetPrice,
      amount: params.amount,
      amountUSD: params.amountUSD,
      expiresInHours: params.expiresInHours,
    });

    return NextResponse.json({ order });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create limit order' },
      { status: 500 }
    );
  }
}
