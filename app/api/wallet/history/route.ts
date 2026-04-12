import { NextRequest, NextResponse } from 'next/server';
import { getTransactionHistory } from '@/lib/wallet/walletManager';

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    const chain = request.nextUrl.searchParams.get('chain');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    if (!wallet || !chain) {
      return NextResponse.json(
        { error: 'wallet and chain parameters required' },
        { status: 400 }
      );
    }

    const history = await getTransactionHistory(wallet, chain, limit);

    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get transaction history' },
      { status: 500 }
    );
  }
}
