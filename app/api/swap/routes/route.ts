import { NextRequest, NextResponse } from "next/server";
import { cacheWithFallback } from "@/lib/cache/redis";
import { getAllRoutes } from "@/lib/services/swap-aggregator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: {
    chain?: string;
    fromToken?: string;
    toToken?: string;
    amountIn?: string;
    slippageBps?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.chain || !body.fromToken || !body.toToken || !body.amountIn) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  // §13 audit fix — server-side slippage cap. Client previously could
  // send slippageBps=9999 and the aggregator would forward it to the
  // upstream router, exposing user funds to MEV/grief. Cap at 5%
  // (500 bps); reject explicit overrides above the cap with 400.
  const MAX_SLIPPAGE_BPS = 500;
  const requestedSlippage = body.slippageBps ?? 100;
  if (requestedSlippage > MAX_SLIPPAGE_BPS) {
    return NextResponse.json({ error: `slippageBps exceeds server cap of ${MAX_SLIPPAGE_BPS}` }, { status: 400 });
  }
  const slippageBps = Math.max(1, Math.min(MAX_SLIPPAGE_BPS, requestedSlippage));

  const key = `swap:routes:${body.chain}:${body.fromToken}:${body.toToken}:${body.amountIn}:${slippageBps}`;
  try {
    const routes = await cacheWithFallback(key, 10, () =>
      getAllRoutes({
        chain: body.chain!,
        fromToken: body.fromToken!,
        toToken: body.toToken!,
        amountIn: body.amountIn!,
        slippageBps,
      }),
    );
    return NextResponse.json({ routes, count: routes.length });
  } catch (err) {
    console.error("[swap/routes]", err);
    return NextResponse.json({ error: "Aggregation failed" }, { status: 502 });
  }
}
