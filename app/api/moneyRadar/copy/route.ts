import { NextRequest, NextResponse } from 'next/server';
import { executeCopyTrade } from '@/lib/moneyRadar/copyTrade';

export async function POST(request: NextRequest) {
  try {
    const params = await request.json();

    const result = await executeCopyTrade(params);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Copy trade failed:', error);
    return NextResponse.json(
      { error: error.message || 'Copy trade failed' },
      { status: 500 }
    );
  }
}
