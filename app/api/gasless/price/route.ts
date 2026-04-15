import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getGaslessPrice, getChainId } from '@/lib/services/zerox';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'ethereum';
    const sellToken = searchParams.get('sellToken');
    const buyToken = searchParams.get('buyToken');
    const sellAmount = searchParams.get('sellAmount');
    const taker = searchParams.get('taker');

    if (!sellToken || !buyToken || !sellAmount || !taker) {
      return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
    }

    const chainId = getChainId(chain);
    if (!chainId) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
    }

    const data = await getGaslessPrice({ chainId, sellToken, buyToken, sellAmount, taker });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gasless price failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
