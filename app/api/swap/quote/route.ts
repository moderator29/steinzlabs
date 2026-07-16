import { logger } from '@/lib/logger';
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSwapQuote, getChainId } from '@/lib/services/zerox';
import { getJupiterQuote, buildSwapTransaction } from '@/lib/services';
import { resolveSwapAddress, resolveSwapDecimals, toBaseUnits } from '@/lib/market/swapTokenMeta';
import { getOnchainDecimals } from '@/lib/services/onchainDecimals';
import { PublicKey } from '@solana/web3.js';

// Associated Token Account derivation (no spl-token dependency needed).
const SPL_TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
function deriveSolanaAta(mint: string, owner: string): string | null {
  try {
    const [ata] = PublicKey.findProgramAddressSync(
      [new PublicKey(owner).toBuffer(), SPL_TOKEN_PROGRAM.toBuffer(), new PublicKey(mint).toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM,
    );
    return ata.toBase58();
  } catch { return null; }
}

// §swap-quote — returns the EXECUTABLE blob the wallet signs. Two gaps this
// route used to have:
//   1. Solana 400'd silently: getChainId('solana') is null, so a Solana
//      request never reached a provider and the swap page's Solana path
//      (which expects `swapTransaction`) could never succeed. It now builds
//      a Jupiter swap transaction for Solana.
//   2. It only accepted canonical addresses + base units. The swap cards
//      send symbols + a human amount, so they had no way to fetch an
//      executable quote. It now accepts `from`/`to`/`amount` (symbols +
//      human) alongside the legacy `sellToken`/`buyToken`/`sellAmount`
//      (addresses + base units).
// EVM → 0x `{ transaction }`; Solana → Jupiter `{ swapTransaction }`.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();
    const taker = searchParams.get('taker');
    const slippageBps = Math.max(1, Math.min(5000, Number(searchParams.get('slippageBps')) || 50));

    const fromInput = searchParams.get('from') ?? searchParams.get('sellToken');
    const toInput = searchParams.get('to') ?? searchParams.get('buyToken');
    const amountInput = searchParams.get('amount') ?? searchParams.get('sellAmount');
    const amountIsBaseUnits = !searchParams.get('amount') && !!searchParams.get('sellAmount');
    const fromDecimalsHint = searchParams.get('fromDecimals') ? Number(searchParams.get('fromDecimals')) : undefined;
    const toDecimalsHint = searchParams.get('toDecimals') ? Number(searchParams.get('toDecimals')) : undefined;

    if (!fromInput || !toInput || !amountInput || !taker) {
      return NextResponse.json(
        { error: 'Missing required params: from, to, amount, taker' },
        { status: 400 },
      );
    }

    const sellAddress = resolveSwapAddress(fromInput, chain);
    const buyAddress = resolveSwapAddress(toInput, chain);
    if (!sellAddress || !buyAddress) {
      return NextResponse.json(
        {
          error: `Unsupported token on ${chain}: ${!sellAddress ? fromInput : toInput}. Pass a valid contract address.`,
          code: 'UNRESOLVED_TOKEN',
        },
        { status: 422 },
      );
    }

    // Base units only need decimals when we have to convert a HUMAN amount;
    // a legacy caller that already sent base units skips the decimals lookup.
    // When the sell token's decimals aren't in the static table (a fresh
    // memecoin), read them on-chain so the trade still resolves.
    let baseAmount = amountInput;
    if (!amountIsBaseUnits) {
      let sellDecimals = resolveSwapDecimals(fromInput, chain, fromDecimalsHint);
      if (sellDecimals === null) sellDecimals = await getOnchainDecimals(chain, sellAddress);
      if (sellDecimals === null) {
        return NextResponse.json(
          { error: `Unknown decimals for ${fromInput} on ${chain}. Pass fromDecimals.`, code: 'UNKNOWN_DECIMALS' },
          { status: 422 },
        );
      }
      baseAmount = toBaseUnits(amountInput, sellDecimals);
    }
    if (baseAmount === '0') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // ── Solana — Jupiter quote → build signable transaction ────────────────
    if (chain === 'solana') {
      const lamports = Number(baseAmount);
      if (!Number.isFinite(lamports) || lamports <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      // Collect the platform fee on Solana too. The fee is taken from the
      // output mint into the treasury's associated token account for that mint.
      // If that account cannot be used (for example it does not exist yet for a
      // brand-new coin), we fall back to a fee-less build so the swap always
      // settles rather than failing.
      const feeWallet = process.env.NEXT_PUBLIC_FEE_RECIPIENT_SOL;
      const feeBps = Number(process.env.NEXT_PUBLIC_STEINZ_FEE_BPS) || 50;
      const feeAccount = feeWallet ? deriveSolanaAta(buyAddress, feeWallet) : null;

      const quote = await getJupiterQuote(sellAddress, buyAddress, lamports, slippageBps, feeAccount ? feeBps : 0);
      if (!quote) {
        return NextResponse.json({ error: 'Jupiter: no route found for this pair' }, { status: 502 });
      }
      let built = feeAccount ? await buildSwapTransaction(quote, taker, { feeAccount }) : await buildSwapTransaction(quote, taker);
      if (!built && feeAccount) {
        const plainQuote = await getJupiterQuote(sellAddress, buyAddress, lamports, slippageBps, 0);
        built = plainQuote ? await buildSwapTransaction(plainQuote, taker) : null;
      }
      if (!built) {
        return NextResponse.json({ error: 'Failed to build Solana swap transaction' }, { status: 502 });
      }
      return NextResponse.json({
        provider: 'jupiter',
        chain: 'solana',
        swapTransaction: built.swapTransaction,
        lastValidBlockHeight: built.lastValidBlockHeight,
        buyAmount: quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        routePlan: quote.routePlan,
        sellTokenAddress: sellAddress,
        buyTokenAddress: buyAddress,
      });
    }

    // ── EVM — 0x quote ─────────────────────────────────────────────────────
    const chainId = getChainId(chain);
    if (!chainId) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
    }

    const data = await getSwapQuote({
      chainId,
      sellToken: sellAddress,
      buyToken: buyAddress,
      sellAmount: baseAmount,
      taker,
      slippageBps,
    });
    return NextResponse.json({
      provider: '0x',
      chain,
      ...data,
      sellTokenAddress: sellAddress,
      buyTokenAddress: buyAddress,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '[swap/quote] failed:');
    Sentry.captureException(error);
    const msg = error instanceof Error ? error.message : 'Swap quote failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
