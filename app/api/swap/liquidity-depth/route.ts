import { NextRequest, NextResponse } from 'next/server';
import { getLiquidityDepth } from '@/lib/services/liquidityDepth';

export const runtime = 'nodejs';

// GET /api/swap/liquidity-depth?token=<address>&chain=<chain>
// Real pool depth from DexScreener + a constant-product slippage estimate.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const chain = req.nextUrl.searchParams.get('chain');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
  const depth = await getLiquidityDepth(token, chain);
  if (!depth) return NextResponse.json({ error: 'no_liquidity_found', token }, { status: 404 });
  return NextResponse.json(depth, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
}
