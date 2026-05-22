import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSwapIntelligenceStrip } from '@/lib/dune/useSurfaces';

/**
 * §5.6 Swap UI pre-trade intelligence (sandwich risk, honeypot flag,
 * smart-money last-hour direction, slippage rec, observed taxes).
 *
 * GET ?token_in=&token_out=&chain=&size_usd=
 */
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token_in = sp.get('token_in')?.trim();
  const token_out = sp.get('token_out')?.trim();
  const chain = sp.get('chain')?.trim();
  const size_usd = Number(sp.get('size_usd')) || 0;
  if (!token_in || !token_out || !chain) {
    return NextResponse.json({ error: 'token_in, token_out, chain required' }, { status: 400 });
  }
  const strip = await getSwapIntelligenceStrip(token_in, token_out, chain, size_usd);
  return NextResponse.json(strip);
}
