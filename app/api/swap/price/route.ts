import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSwapPrice, getChainId } from '@/lib/services/zerox';
import { getJupiterQuote } from '@/lib/services';
import { getDLCoinPrices } from '@/lib/services/defillama';
import { resolveSwapToken, resolveSwapAddress, toBaseUnits, fromBaseUnits } from '@/lib/market/swapTokenMeta';
import { getOnchainDecimals } from '@/lib/services/onchainDecimals';

/**
 * Resolve a token whose ADDRESS is valid but whose decimals the static table
 * doesn't carry, by reading decimals on-chain. Returns null only when the
 * input isn't a resolvable address at all.
 */
async function resolveWithOnchain(
  input: string,
  chain: string,
  hint: number | undefined,
): Promise<{ address: string; decimals: number } | null> {
  const address = resolveSwapAddress(input, chain);
  if (!address) return null;
  const decimals = hint ?? (await getOnchainDecimals(chain, address));
  if (decimals == null) return null;
  return { address, decimals };
}

// DeFiLlama chain slugs + native-gas coingecko ids, used ONLY to turn the
// real quantities 0x already returns (buyAmount, gas, gasPrice) into a
// value-based price impact and a USD network-fee figure. No price is
// invented: when DeFiLlama has no confident quote for a token we return
// null and the UI shows an honest "—".
const DL_CHAIN_SLUG: Record<string, string> = {
  ethereum: 'ethereum', base: 'base', arbitrum: 'arbitrum',
  polygon: 'polygon', avalanche: 'avax', bsc: 'bsc', optimism: 'optimism',
};
const NATIVE_CG_ID: Record<string, string> = {
  ethereum: 'ethereum', base: 'ethereum', arbitrum: 'ethereum', optimism: 'ethereum',
  polygon: 'matic-network', avalanche: 'avalanche-2', bsc: 'binancecoin',
};
const NATIVE_SENTINELS = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000000000',
]);

/**
 * DeFiLlama coins key for a token address on an EVM chain (native →
 * coingecko). The address is lowercased so the request key matches the
 * lowercased key DeFiLlama echoes back in its response.
 */
function dlKey(address: string, chain: string): string | null {
  const a = address.toLowerCase();
  if (NATIVE_SENTINELS.has(a)) {
    const id = NATIVE_CG_ID[chain];
    return id ? `coingecko:${id}` : null;
  }
  const slug = DL_CHAIN_SLUG[chain];
  return slug ? `${slug}:${a}` : null;
}

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

    // Resolve each token to { address, decimals }. Address resolution handles
    // symbols + raw addresses/mints; decimals come from the static table or a
    // caller hint. When a real address resolves but its decimals are unknown
    // (a brand-new memecoin the table has never seen), read them straight from
    // the chain so the quote never fails for a genuinely tradable coin.
    let sell = resolveSwapToken(fromInput, chain, fromDecimalsHint);
    let buy = resolveSwapToken(toInput, chain, toDecimalsHint);
    if (!sell) sell = await resolveWithOnchain(fromInput, chain, fromDecimalsHint);
    if (!buy) buy = await resolveWithOnchain(toInput, chain, toDecimalsHint);
    if (!sell || !buy) {
      return NextResponse.json(
        {
          error: `Unsupported token on ${chain}: ${!sell ? fromInput : toInput}. Pass a valid contract address.`,
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
        // No real Solana network-fee estimate available here; return null so the
        // UI shows an honest dash instead of a fabricated flat 0.001.
        gasEstimateUsd: null,
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
    const minReceived = toAmountHuman * (1 - slippageBps / 10_000);

    // ── Real price impact + USD network fee ──────────────────────────────
    // 0x's v2 Swap API does NOT return a price-impact figure (the old code
    // defaulted it to "0", so every EVM swap fabricated a 0% impact). We
    // derive a real value-based impact — the same method Jupiter/1inch use —
    // from confident DeFiLlama mid-prices, and convert 0x's real gas estimate
    // to USD. Anything we can't source confidently stays null → honest "—".
    // Kept as a numeric STRING (or null) to match the shape every existing
    // consumer parses (`typeof x === 'string' ? parseFloat(x) : …`) — the
    // Solana path above and 0x's own field are strings too. null = unknown.
    let priceImpactPct: string | null = null;
    let gasEstimateUsd: number | null = null;

    // Prefer a real impact field if 0x ever supplies one on this pair/chain.
    const zxImpact = Number(raw.estimatedPriceImpact);
    if (Number.isFinite(zxImpact) && raw.estimatedPriceImpact != null && raw.estimatedPriceImpact !== '') {
      priceImpactPct = String(zxImpact);
    }

    try {
      const sellKey = dlKey(sell.address, chain);
      const buyKey = dlKey(buy.address, chain);
      const nativeKey = NATIVE_CG_ID[chain] ? `coingecko:${NATIVE_CG_ID[chain]}` : null;
      const wanted = Array.from(new Set([sellKey, buyKey, nativeKey].filter(Boolean) as string[]));
      const prices = wanted.length ? await getDLCoinPrices(wanted) : {};

      if (priceImpactPct === null && sellKey && buyKey) {
        const sp = prices[sellKey];
        const bp = prices[buyKey];
        // Require confident quotes on BOTH legs — a stale/low-confidence
        // oracle price would produce a misleading impact number.
        if (sp && bp && sp.price > 0 && bp.price > 0
          && (sp.confidence ?? 0) >= 0.9 && (bp.confidence ?? 0) >= 0.9
          && fromAmountHuman > 0 && toAmountHuman > 0) {
          const midRate = sp.price / bp.price;          // buy tokens per sell token at market mid
          const execRate = toAmountHuman / fromAmountHuman; // buy tokens per sell token, as quoted
          const impact = (1 - execRate / midRate) * 100;
          // Clamp oracle noise (tiny negatives) to 0; ignore implausible
          // outliers rather than surface a nonsense figure.
          if (Number.isFinite(impact) && impact > -3 && impact < 99) {
            priceImpactPct = String(Math.max(0, Number(impact.toFixed(2))));
          }
        }
      }

      const gasUnits = Number(raw.gas);
      const gasPrice = Number(raw.gasPrice);
      const np = nativeKey ? prices[nativeKey] : undefined;
      if (Number.isFinite(gasUnits) && gasUnits > 0 && Number.isFinite(gasPrice) && gasPrice > 0
        && np && np.price > 0) {
        const gasNative = (gasUnits * gasPrice) / 1e18; // wei → native token
        gasEstimateUsd = gasNative * np.price;
      }
    } catch {
      /* DeFiLlama unavailable — leave impact/gas null, never fabricate. */
    }

    return NextResponse.json({
      chain,
      provider: '0x',
      sellTokenAddress: sell.address,
      buyTokenAddress: buy.address,
      toAmount: toAmountHuman,
      rate,
      priceImpactPct,
      gasEstimateUsd,
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
