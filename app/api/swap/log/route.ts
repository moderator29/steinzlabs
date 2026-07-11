import { logger } from '@/lib/logger';
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { recordSwapLog, recordFeeRevenue, PLATFORM_FEE_BPS } from '@/lib/trading/swapLogging';

export async function POST(request: NextRequest) {
  try {
    // AUTHENTICATE. This route writes swap_logs + fee_revenue via the service
    // role; leaving it open let anyone POST fabricated rows and attribute them
    // to any wallet. The logged-in user is the authoritative owner now.
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } },
    );
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      walletAddress,
      txHash,
      chain,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      platformFeeBps,
      status,
      feeUsd: clientFeeUsdRaw,
    } = body as {
      walletAddress: string;
      txHash: string;
      chain: string;
      fromToken: string;
      toToken: string;
      fromAmount: number;
      toAmount: number;
      platformFeeBps?: number;
      status?: string;
      feeUsd?: number;
    };

    if (!walletAddress || !txHash || !chain || !fromToken || !toToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const feeBps = platformFeeBps || PLATFORM_FEE_BPS;
    // 0x v2 collects the fee in the BUY token (swapFeeToken = buyToken), so
    // revenue is feeBps of the OUTPUT quantity, denominated in the buy token.
    // EXCEPT a native-ETH buy: 0x rejects the native sentinel as a fee token,
    // so lib/services/zerox.ts takes the fee in the SELL token instead. Mirror
    // that exact rule here or the recorded fee_token/fee_amount would not match
    // what 0x actually charged (e.g. a NAKA -> ETH swap collects the fee in
    // NAKA, not ETH). Detect native by gas symbol or the 0x/zero sentinels.
    const NATIVE_SYMBOLS = new Set(['ETH', 'BNB', 'MATIC', 'AVAX', 'SOL']);
    const buyIsNative =
      NATIVE_SYMBOLS.has(String(toToken).toUpperCase()) ||
      String(toToken).toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      String(toToken).toLowerCase() === '0x0000000000000000000000000000000000000000';
    const feeToken = buyIsNative ? fromToken : toToken;
    const feeAmountToken = (buyIsNative ? (fromAmount || 0) : (toAmount || 0)) * (feeBps / 10000);
    // USD value: ONLY a real figure the client computed from the live quote is
    // used. The old code set usd = fromAmount * feeBps/10000, i.e. it treated a
    // raw token quantity as dollars (a 0.5 ETH fee logged as ~$0.0025). We never
    // fabricate USD from a token count; unknown stays null (honest).
    const feeUsd = typeof clientFeeUsdRaw === 'number' && Number.isFinite(clientFeeUsdRaw) && clientFeeUsdRaw >= 0
      ? clientFeeUsdRaw
      : null;
    const userId = authUser.id;

    await recordSwapLog(db, {
      user_id: userId,
      token_in: fromToken,
      token_out: toToken,
      amount_in: fromAmount,
      amount_out: toAmount,
      fee_usd: feeUsd,
      chain,
      status: status === 'failed' ? 'failed' : 'confirmed',
      tx_hash: txHash,
      // Unified Activity ledger attribution.
      wallet_address: walletAddress,
      source: (body as { source?: string }).source ?? 'swap-page',
    });

    // Only a confirmed swap actually collected a fee; a failed swap must not
    // inflate fee_revenue.
    if (status !== 'failed') {
      await recordFeeRevenue(db, {
        user_id: userId,
        tx_hash: txHash,
        fee_amount: feeAmountToken,
        fee_token: feeToken,
        usd_value: feeUsd,
        chain,
      });
    }

    return NextResponse.json({ success: true, feeUsd });
  } catch (error) {
    logger.error({ err: error }, '[Swap Log] Unexpected error:');
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Failed to log swap' }, { status: 500 });
  }
}
