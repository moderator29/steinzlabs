import 'server-only';
import { NextResponse } from 'next/server';
import { analyseMevProtection, MevChain } from '@/lib/services/mev';
import { withCache, cacheKey } from '@/lib/api/cache-manager';

export const runtime = 'nodejs';

const VALID_CHAINS = new Set<string>(['solana', 'ethereum', 'base', 'arbitrum', 'bsc']);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token') ?? searchParams.get('address');
    const chain = (searchParams.get('chain') ?? 'ethereum').toLowerCase();
    const amountStr = searchParams.get('amount');

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Missing required parameter: token (token address)' },
        { status: 400 },
      );
    }

    if (!VALID_CHAINS.has(chain)) {
      return NextResponse.json(
        { error: `Unsupported chain. Supported: ${[...VALID_CHAINS].join(', ')}` },
        { status: 400 },
      );
    }

    const swapAmountUsd = amountStr ? parseFloat(amountStr) : 1000;
    if (isNaN(swapAmountUsd) || swapAmountUsd <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount parameter' },
        { status: 400 },
      );
    }

    const currentSlippageBps = parseInt(searchParams.get('slippage') ?? '50', 10);

    const key = cacheKey('mev', chain, tokenAddress, String(Math.ceil(swapAmountUsd / 1000)));

    const analysis = await withCache(key, 30_000, () =>
      analyseMevProtection({
        tokenAddress,
        chain: chain as MevChain,
        swapAmountUsd,
        currentSlippageBps,
      }),
    );

    return NextResponse.json(analysis, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'MEV analysis failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenAddress, chain = 'ethereum', swapAmountUsd = 1000, currentSlippageBps = 50 } = body;

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Missing required field: tokenAddress' },
        { status: 400 },
      );
    }

    if (!VALID_CHAINS.has(chain)) {
      return NextResponse.json(
        { error: `Unsupported chain. Supported: ${[...VALID_CHAINS].join(', ')}` },
        { status: 400 },
      );
    }

    const analysis = await analyseMevProtection({
      tokenAddress,
      chain: chain as MevChain,
      swapAmountUsd: typeof swapAmountUsd === 'number' ? swapAmountUsd : parseFloat(swapAmountUsd),
      currentSlippageBps: typeof currentSlippageBps === 'number' ? currentSlippageBps : parseInt(currentSlippageBps, 10),
    });

    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json(
      { error: 'MEV analysis failed' },
      { status: 500 },
    );
  }
}
