import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSwapPrice, getChainId } from '@/lib/services/zerox';
import { getJupiterQuote } from '@/lib/services';

// §swap-price-solana — was EVM-only via 0x; Solana requests 400'd silently
// and SwapCard fell through with no quote and no price impact. Added a
// Solana branch that calls Jupiter and returns a shape that includes
// `priceImpactPct` so EVM (0x.estimatedPriceImpact) and Solana
// (jupiter.priceImpactPct) speak the same field.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'ethereum';
    const sellToken = searchParams.get('sellToken');
    const buyToken = searchParams.get('buyToken');
    const sellAmount = searchParams.get('sellAmount');
    const taker = searchParams.get('taker') || undefined;

    if (!sellToken || !buyToken || !sellAmount) {
      return NextResponse.json({ error: 'Missing required params: sellToken, buyToken, sellAmount' }, { status: 400 });
    }

    if (chain === 'solana') {
      const amount = Number(sellAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Invalid sellAmount' }, { status: 400 });
      }
      const quote = await getJupiterQuote(sellToken, buyToken, amount);
      if (!quote) {
        return NextResponse.json({ error: 'Jupiter quote unavailable' }, { status: 502 });
      }
      // Normalised shape — `priceImpactPct` matches EVM's field name (0x
      // uses `estimatedPriceImpact`; we rename when we adopt it below).
      return NextResponse.json({
        chain: 'solana',
        provider: 'jupiter',
        sellToken: quote.inputMint,
        buyToken: quote.outputMint,
        sellAmount: quote.inAmount,
        buyAmount: quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        slippageBps: quote.slippageBps,
        routePlan: quote.routePlan,
        gasEstimateUsd: 0.001,
      });
    }

    const chainId = getChainId(chain);
    if (!chainId) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
    }

    const data = await getSwapPrice({ chainId, sellToken, buyToken, sellAmount, taker });
    // §EVM normalisation — 0x calls it `estimatedPriceImpact` (string),
    // surface `priceImpactPct` for parity with the Solana branch so the
    // UI and SwapCard read one consistent field across chains.
    const raw = data as unknown as Record<string, unknown>;
    const priceImpactPct = (raw.estimatedPriceImpact as string | undefined) ?? '0';
    return NextResponse.json({ ...raw, priceImpactPct });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Swap price failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
