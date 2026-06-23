import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSwapPrice, getChainId } from '@/lib/services/zerox';
import { getJupiterQuote } from '@/lib/services';
import { resolveSwapToken, toBaseUnits, fromBaseUnits } from '@/lib/market/swapTokenMeta';

// §swap-price — this route is the quote probe behind the swap cards. It
// historically only accepted `sellToken/buyToken/sellAmount` as canonical
// ADDRESSES + BASE UNITS, but the cards send `from/to/amount` as SYMBOLS +
// a HUMAN amount → it 400'd on every card request and the card fell through
// to a "~" placeholder with no price impact. It now:
//   1. Accepts both param styles (`from`/`to`/`amount` preferred, legacy
//      `sellToken`/`buyToken`/`sellAmount` still honoured).
//   2. Resolves symbols → canonical addresses and converts human → base
//      units via the shared resolveSwapToken (EVM + Solana).
//   3. Returns ONE normalised shape across chains: human `toAmount` + `rate`
//      + `priceImpactPct` + `minReceived` + `slippageBps` + a `quoteData`
//      blob carrying the token ADDRESSES so the Trust badge + route preview
//      light up.
// Unknown tokens (unsupported symbol with no decimals) return 422 with a
// clear message rather than a fabricated quote.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();
    const taker = searchParams.get('taker') || undefined;
    const slippageBps = Math.max(1, Math.min(5000, Number(searchParams.get('slippageBps')) || 50));

    // New (card) params take precedence; legacy params are the fallback.
    const fromInput = searchParams.get('from') ?? searchParams.get('sellToken');
    const toInput = searchParams.get('to') ?? searchParams.get('buyToken');
    const amountInput = searchParams.get('amount') ?? searchParams.get('sellAmount');
    // Whether `amountInput` is already in base units (legacy callers) or a
    // human amount (the cards). `sellAmount` was always base units; `amount`
    // is always human.
    const amountIsBaseUnits = !searchParams.get('amount') && !!searchParams.get('sellAmount');
    const fromDecimalsHint = searchParams.get('fromDecimals') ? Number(searchParams.get('fromDecimals')) : undefined;
    const toDecimalsHint = searchParams.get('toDecimals') ? Number(searchParams.get('toDecimals')) : undefined;

    if (!fromInput || !toInput || !amountInput) {
      return NextResponse.json(
        { error: 'Missing required params: from, to, amount' },
        { status: 400 },
      );
    }

    const sell = resolveSwapToken(fromInput, chain, fromDecimalsHint);
    const buy = resolveSwapToken(toInput, chain, toDecimalsHint);
    if (!sell || !buy) {
      return NextResponse.json(
        {
          error: `Unsupported token on ${chain}: ${!sell ? fromInput : toInput}. ` +
            `Pass a contract address (and decimals for unknown Solana mints).`,
          code: 'UNRESOLVED_TOKEN',
        },
        { status: 422 },
      );
    }

    const baseAmount = amountIsBaseUnits ? amountInput : toBaseUnits(amountInput, sell.decimals);
    if (baseAmount === '0') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (chain === 'solana') {
      const lamports = Number(baseAmount);
      if (!Number.isFinite(lamports) || lamports <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      const quote = await getJupiterQuote(sell.address, buy.address, lamports, slippageBps);
      if (!quote) {
        return NextResponse.json({ error: 'Jupiter quote unavailable' }, { status: 502 });
      }
      const toAmountHuman = fromBaseUnits(quote.outAmount, buy.decimals);
      const fromAmountHuman = fromBaseUnits(quote.inAmount, sell.decimals);
      const rate = fromAmountHuman > 0 ? toAmountHuman / fromAmountHuman : 0;
      const minReceived = toAmountHuman * (1 - slippageBps / 10_000);
      return NextResponse.json({
        chain: 'solana',
        provider: 'jupiter',
        sellTokenAddress: sell.address,
        buyTokenAddress: buy.address,
        toAmount: toAmountHuman,
        rate,
        priceImpactPct: quote.priceImpactPct,
        minReceived,
        slippageBps,
        quoteData: {
          sellTokenAddress: sell.address,
          buyTokenAddress: buy.address,
          routePlan: quote.routePlan,
        },
        gasEstimateUsd: 0.001,
      });
    }

    const chainId = getChainId(chain);
    if (!chainId) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
    }

    const data = await getSwapPrice({
      chainId,
      sellToken: sell.address,
      buyToken: buy.address,
      sellAmount: baseAmount,
      taker,
    });
    const raw = data as unknown as Record<string, unknown>;
    const buyAmountBase = String(raw.buyAmount ?? '0');
    const toAmountHuman = fromBaseUnits(buyAmountBase, buy.decimals);
    const fromAmountHuman = fromBaseUnits(baseAmount, sell.decimals);
    const rate = fromAmountHuman > 0 ? toAmountHuman / fromAmountHuman : 0;
    const priceImpactPct = (raw.estimatedPriceImpact as string | undefined) ?? '0';
    const minReceived = toAmountHuman * (1 - slippageBps / 10_000);
    return NextResponse.json({
      chain,
      provider: '0x',
      sellTokenAddress: sell.address,
      buyTokenAddress: buy.address,
      toAmount: toAmountHuman,
      rate,
      priceImpactPct,
      minReceived,
      slippageBps,
      quoteData: {
        sellTokenAddress: sell.address,
        buyTokenAddress: buy.address,
        route: raw.route,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Swap price failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
