import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getSwapQuote, getChainId } from "@/lib/services/zerox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const cookieStore = cookies();
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
  status: string;
  expires_at: string;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase();
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
        "id,user_id,chain,wallet_source,from_token_address,to_token_address,amount_in,slippage_bps,status,expires_at",
      )
      .eq("id", params.id)
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
    });

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
