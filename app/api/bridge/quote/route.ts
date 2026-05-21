import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getLifiQuote, getLifiRoutes } from '@/lib/services/lifi';

/**
 * POST /api/bridge/quote
 *
 * Body: { fromChain, toChain, fromToken, toToken, fromAmount, fromAddress,
 *         toAddress?, slippage?, multi? }
 *
 * Returns the LiFi single best quote (default) or all candidate routes when
 * `multi: true` is set. The frontend signs the returned step's
 * transactionRequest after the user confirms.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  fromChain?: string | number;
  toChain?: string | number;
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  fromAddress?: string;
  toAddress?: string;
  slippage?: number;
  multi?: boolean;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const required = ['fromChain', 'toChain', 'fromToken', 'toToken', 'fromAmount', 'fromAddress'] as const;
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === '') {
      return NextResponse.json({ error: `Missing ${k}` }, { status: 400 });
    }
  }

  const params = {
    fromChain: body.fromChain!,
    toChain: body.toChain!,
    fromToken: body.fromToken!,
    toToken: body.toToken!,
    fromAmount: body.fromAmount!,
    fromAddress: body.fromAddress!,
    toAddress: body.toAddress,
    slippage: body.slippage,
  };

  if (body.multi) {
    const routes = await getLifiRoutes(params);
    return NextResponse.json({ routes });
  }

  const quote = await getLifiQuote(params);
  if (!quote) {
    return NextResponse.json({ error: 'No route available' }, { status: 404 });
  }
  return NextResponse.json({ quote });
}
