import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getSwapQuote, getChainId, needsPermit2 } from '@/lib/services/zerox';
import { checkOfac } from '@/lib/security/ofac';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SWAP_RISK_THRESHOLD } from '@/lib/market/constants';
import { resolveTokenAddress } from '@/lib/market/tokenResolver';
import { resolveSwapDecimals, toBaseUnits } from '@/lib/market/swapTokenMeta';
import { getUserByWallet } from '@/lib/database/supabase';
import { recordSwapLog } from '@/lib/trading/swapLogging';

export const dynamic = 'force-dynamic';

interface ExecuteBody {
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInUSD: number;
  slippage: number;
  walletAddress: string;
  userId?: string;
  // §3 P1-E (carry-over from P0 #1) — multi-aggregator wiring. When the
  // user picks KyberSwap / OpenOcean / 1inch in RouteComparison, the
  // frontend sends `selectedProvider` plus the provider's own quoteData
  // blob. We return that blob unchanged for the client to broadcast,
  // and tag swap_logs.dex accordingly so prod can confirm via
  // SELECT dex, COUNT(*) FROM swap_logs.
  selectedProvider?: '0x' | '1inch' | 'kyberswap' | 'openocean' | 'jupiter';
  routeQuoteData?: {
    transaction?: { to?: string; data?: string; value?: string; gas?: string };
    allowanceTarget?: string;
    buyAmount?: string;
    raw?: unknown;
  };
  // §swap-real-broadcast — authoritative sell amount in BASE UNITS (wei /
  // smallest token unit). When the client can compute this (it knows the
  // token + decimals), it's used verbatim; 0x requires base units, and the
  // old code passed the human `amountIn` straight through → quotes were off
  // by 10**decimals. Falls back to converting `amountIn` with resolved
  // decimals when absent.
  sellAmountBase?: string;
  /** Decimals of `tokenIn`, when the client knows them (unknown SELL tokens). */
  tokenInDecimals?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExecuteBody;
    const { chain, tokenIn, tokenOut, amountIn, amountInUSD, slippage, walletAddress, userId, selectedProvider, routeQuoteData, sellAmountBase, tokenInDecimals } = body;

    if (!chain || !tokenIn || !tokenOut || !amountIn || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Img 17 fix: 0x rejects non-hex tokens with INPUT_INVALID. Users saw
    // "Invalid ethereum address" when buying BTC because we passed the
    // symbol "BTC" straight through. Resolve symbols to canonical
    // addresses (BTC → WBTC on Ethereum, cbBTC on Base, BTCB on BSC, etc.)
    // before anything else.
    const resolvedIn = resolveTokenAddress(tokenIn, chain);
    const resolvedOut = resolveTokenAddress(tokenOut, chain);
    if (!resolvedIn || !resolvedOut) {
      return NextResponse.json(
        {
          error: `Cannot resolve "${!resolvedIn ? tokenIn : tokenOut}" on ${chain}. ` +
            `Pass a contract address or a known symbol.`,
          code: 'UNRESOLVED_TOKEN',
        },
        { status: 400 },
      );
    }

    // Step 1: Security scan on output token
    const security = await getTokenSecurity(resolvedOut, chain).catch(() => null);
    const riskScore = (security as unknown as Record<string, unknown>)?.riskScore as number ?? 0;

    if (riskScore > SWAP_RISK_THRESHOLD) {
      return NextResponse.json({
        blocked: true,
        blockReason: `Token failed security scan (Risk Score: ${riskScore}/100)`,
        riskScore,
      }, { status: 200 });
    }

    // §3 P1-D.4 — OFAC blocklist gate. Refuse to quote a swap when the
    // taker is sanctioned. Falls open if Chainalysis is unreachable.
    const ofac = await checkOfac(walletAddress);
    if (ofac.sanctioned) {
      return NextResponse.json({
        blocked: true,
        blockReason: 'Wallet appears on the OFAC SDN list',
        ofac,
      }, { status: 403 });
    }

    // §3 P1-E — Step 2: Resolve the executable quote. If the user picked
    // a non-0x provider in RouteComparison, honor that selection by
    // returning the provider's own quoteData blob verbatim; otherwise
    // fall back to 0x (the historical default) and run the P1-D.3
    // Permit2 detection below.
    const provider = selectedProvider ?? '0x';
    const feePercent = 0.4;
    const feeUSD = amountInUSD * 0.004;
    const db = getSupabaseAdmin();
    // swap_logs.user_id is NOT NULL; trust the client userId if present, else
    // resolve from the wallet so the row actually lands.
    const resolvedUserId = userId ?? (await getUserByWallet(walletAddress))?.id ?? null;

    if (provider !== '0x' && routeQuoteData?.transaction?.data) {
      await recordSwapLog(db, {
        user_id: resolvedUserId,
        chain,
        token_in: resolvedIn,
        token_out: resolvedOut,
        amount_in: parseFloat(amountIn),
        fee_usd: feeUSD,
        status: 'pending',
        dex: provider,
      });
      return NextResponse.json({
        success: true,
        riskScore,
        feeUSD,
        feePercent,
        provider,
        transaction: routeQuoteData.transaction,
        allowanceTarget: routeQuoteData.allowanceTarget ?? null,
        buyAmount: routeQuoteData.buyAmount ?? null,
        slippage,
        walletAddress,
      });
    }

    const chainId = getChainId(chain);
    if (!chainId) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
    }

    // §swap-real-broadcast — 0x needs BASE UNITS. Prefer the client's
    // authoritative `sellAmountBase`; otherwise convert the human `amountIn`
    // using the sell token's resolved decimals. Refuse rather than send a
    // wrong-by-10**decimals quote when decimals can't be determined.
    let sellAmount = sellAmountBase;
    if (!sellAmount) {
      const decimals = resolveSwapDecimals(tokenIn, chain, tokenInDecimals);
      if (decimals === null) {
        return NextResponse.json(
          { error: `Cannot determine decimals for "${tokenIn}" on ${chain}. Pass sellAmountBase or tokenInDecimals.`, code: 'UNKNOWN_DECIMALS' },
          { status: 422 },
        );
      }
      sellAmount = toBaseUnits(amountIn, decimals);
    }
    if (!sellAmount || sellAmount === '0') {
      return NextResponse.json({ error: 'Invalid trade amount' }, { status: 400 });
    }

    // §3 P1-D.3 — auto-select Permit2 endpoint when the user has no
    // existing allowance, so the swap is 1 tx instead of 2.
    const permit2 = await needsPermit2({
      chainId,
      sellToken: resolvedIn,
      owner: walletAddress,
      sellAmount,
    });

    const quote = await getSwapQuote({
      chainId,
      sellToken: resolvedIn,
      buyToken: resolvedOut,
      sellAmount,
      taker: walletAddress,
      permit2,
    });

    await recordSwapLog(db, {
      user_id: resolvedUserId,
      chain,
      token_in: resolvedIn,
      token_out: resolvedOut,
      amount_in: parseFloat(amountIn),
      fee_usd: feeUSD,
      status: 'pending',
      dex: '0x',
    });

    return NextResponse.json({
      success: true,
      riskScore,
      feeUSD,
      feePercent,
      provider: '0x',
      transaction: quote.transaction,
      allowanceTarget: quote.allowanceTarget,
      buyAmount: quote.buyAmount,
      gas: quote.gas,
      route: quote.route,
      fees: quote.fees,
      slippage,
      walletAddress,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Trade execution failed' }, { status: 500 });
  }
}
