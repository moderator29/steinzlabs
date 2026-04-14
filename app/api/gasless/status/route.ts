import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getGaslessStatus } from '@/lib/services/zerox';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tradeHash = searchParams.get('tradeHash');

    if (!tradeHash) {
      return NextResponse.json({ error: 'Missing tradeHash param' }, { status: 400 });
    }

    const data = await getGaslessStatus(tradeHash);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gasless status check failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
