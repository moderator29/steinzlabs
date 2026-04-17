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

  const key = `swap:routes:${body.chain}:${body.fromToken}:${body.toToken}:${body.amountIn}`;
  try {
    const routes = await cacheWithFallback(key, 10, () =>
      getAllRoutes({
        chain: body.chain!,
        fromToken: body.fromToken!,
        toToken: body.toToken!,
        amountIn: body.amountIn!,
        slippageBps: body.slippageBps ?? 100,
      }),
    );
    return NextResponse.json({ routes, count: routes.length });
  } catch (err) {
    console.error("[swap/routes]", err);
    return NextResponse.json({ error: "Aggregation failed" }, { status: 502 });
  }
}
