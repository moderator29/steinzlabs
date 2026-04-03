import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quote, userWallet, userAddress, chain, autoExit, followingEntity } = body;

    if (!quote || !userWallet || !userAddress || !chain) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = {
      success: true,
      message: 'Trade prepared - sign transaction in wallet',
      quote,
      autoExit,
      followingEntity,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Execute trade failed:', error);
    return NextResponse.json(
      { error: error.message || 'Trade execution failed' },
      { status: 500 }
    );
  }
}
