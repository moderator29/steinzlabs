import { NextRequest, NextResponse } from 'next/server';
import { getTokenApprovals, revokeApproval } from '@/lib/wallet/walletManager';

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    const chain = request.nextUrl.searchParams.get('chain');

    if (!wallet || !chain) {
      return NextResponse.json(
        { error: 'wallet and chain parameters required' },
        { status: 400 }
      );
    }

    const approvals = await getTokenApprovals(wallet, chain);

    return NextResponse.json({ approvals });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get approvals' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { approvalId, userWallet } = await request.json();

    if (!approvalId || !userWallet) {
      return NextResponse.json(
        { error: 'approvalId and userWallet required' },
        { status: 400 }
      );
    }

    const result = await revokeApproval(approvalId, userWallet);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to revoke approval' },
      { status: 500 }
    );
  }
}
