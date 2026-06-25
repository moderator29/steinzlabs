import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getSwapQuote, getChainId } from "@/lib/services/zerox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

/**
 * Prepare a signable transaction for a pending trade. Called by the inline
 * signer in the browser right before it asks the wallet to sign. We re-quote
 * at this moment to get a fresh route and a transaction bound to the user's
 * current wallet address (taker).
 *
 * Solana quotes come from Jupiter at sign-time in the client itself (the
 * client uses window.solana plus /api/swap/quote with chain=solana). For EVM
 * we use 0x and return a ready-to-sign tx envelope.
 */
interface PendingRow {
  id: string;
  user_id: string;
  chain: string;
  wallet_source: "external_evm" | "external_solana" | "builtin";
  from_token_address: string;
  to_token_address: string;
  amount_in: string;
  slippage_bps: number;
  expected_amount_out: string | null;
  status: string;
  expires_at: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { taker?: string };
    const taker = body.taker;
    if (!taker || typeof taker !== "string") {
      return NextResponse.json({ error: "taker address required" }, { status: 400 });
    }

    const { data: pending } = await supabase
      .from("pending_trades")
      .select(
        "id,user_id,chain,wallet_source,from_token_address,to_token_address,amount_in,slippage_bps,expected_amount_out,status,expires_at",
      )
      .eq("id", id)
      .single<PendingRow>();

    if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (pending.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pending.status !== "pending") {
      return NextResponse.json({ error: `Already ${pending.status}` }, { status: 409 });
    }
    if (new Date(pending.expires_at) < new Date()) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }

    if (pending.chain.toLowerCase() === "solana") {
      // Solana path: the client will use Jupiter directly through the swap
      // aggregator using the route fields below. We don't pre-build the tx
      // server-side because Jupiter's versioned tx must be constructed with
      // the taker's blockhash at broadcast time.
      return NextResponse.json({
        chain: "solana",
        sellToken: pending.from_token_address,
        buyToken: pending.to_token_address,
        sellAmount: pending.amount_in,
        slippageBps: pending.slippage_bps,
      });
    }

    const chainId = getChainId(pending.chain);
    if (!chainId) {
      return NextResponse.json(
        { error: `Unsupported chain: ${pending.chain}` },
        { status: 400 },
      );
    }

    const quote = await getSwapQuote({
      chainId,
      sellToken: pending.from_token_address,
      buyToken: pending.to_token_address,
      sellAmount: pending.amount_in,
      taker,
      slippageBps: pending.slippage_bps,
    });

    // Risk #6 — slippage re-validation. The pending row was created with a
    // route quoted at insert time; the market may have moved by now. Reject
    // when the live buyAmount falls below the slippage tolerance applied to
    // the original expected_amount_out. The user can re-queue from the UI
    // instead of unwittingly signing a worse trade.
    if (pending.expected_amount_out && quote.buyAmount) {
      try {
        const live = BigInt(quote.buyAmount);
        const expected = BigInt(pending.expected_amount_out);
        const tolerance = BigInt(Math.max(0, 10_000 - pending.slippage_bps));
        const TEN_THOUSAND = BigInt(10_000);
        const floor = (expected * tolerance) / TEN_THOUSAND;
        if (live < floor) {
          return NextResponse.json(
            {
              error: "slippage_exceeded",
              expected_amount_out: pending.expected_amount_out,
              live_amount_out: quote.buyAmount,
              slippage_bps: pending.slippage_bps,
            },
            { status: 409 },
          );
        }
      } catch {
        // Non-integer amount strings just skip the gate — never block sign
        // on a parse failure.
      }
    }

    return NextResponse.json({
      chain: pending.chain,
      quote,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "pending-trades.prepare" } });
    const msg = err instanceof Error ? err.message : "Prepare failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
