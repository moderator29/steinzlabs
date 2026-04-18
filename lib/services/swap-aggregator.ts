import { getOneInchQuote } from "./oneinch";
import { getKyberswapQuote } from "./kyberswap";
import { getOpenOceanQuote } from "./openocean";

export interface RouteQuote {
  provider: "0x" | "jupiter" | "1inch" | "kyberswap" | "openocean";
  chain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  amountOut: string;
  amountOutUsd: number | null;
  priceImpactBps: number | null;
  gasUsd: number | null;
  netOutputUsd: number | null;
  raw: unknown;
  fetchedAt: number;
}

export interface AggregatorParams {
  chain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  slippageBps?: number;
}

async function oneinchToRoute(p: AggregatorParams): Promise<RouteQuote | null> {
  const q = await getOneInchQuote({ chain: p.chain, fromToken: p.fromToken, toToken: p.toToken, amount: p.amountIn });
  if (!q) return null;
  return {
    provider: "1inch",
    chain: p.chain,
    fromToken: p.fromToken,
    toToken: p.toToken,
    amountIn: p.amountIn,
    amountOut: q.toAmount,
    amountOutUsd: null,
    priceImpactBps: null,
    gasUsd: null,
    netOutputUsd: null,
    raw: q,
    fetchedAt: Date.now(),
  };
}

async function kyberToRoute(p: AggregatorParams): Promise<RouteQuote | null> {
  const q = await getKyberswapQuote({ chain: p.chain, fromToken: p.fromToken, toToken: p.toToken, amount: p.amountIn });
  if (!q) return null;
  const gasUsd = q.gasUsd ? Number(q.gasUsd) : null;
  const outUsd = q.amountOutUsd ? Number(q.amountOutUsd) : null;
  return {
    provider: "kyberswap",
    chain: p.chain,
    fromToken: p.fromToken,
    toToken: p.toToken,
    amountIn: p.amountIn,
    amountOut: q.outputAmount,
    amountOutUsd: outUsd,
    priceImpactBps: null,
    gasUsd,
    netOutputUsd: outUsd !== null && gasUsd !== null ? outUsd - gasUsd : outUsd,
    raw: q,
    fetchedAt: Date.now(),
  };
}

async function openoceanToRoute(p: AggregatorParams): Promise<RouteQuote | null> {
  const q = await getOpenOceanQuote({ chain: p.chain, fromToken: p.fromToken, toToken: p.toToken, amount: p.amountIn });
  if (!q?.outAmount) return null;
  return {
    provider: "openocean",
    chain: p.chain,
    fromToken: p.fromToken,
    toToken: p.toToken,
    amountIn: p.amountIn,
    amountOut: q.outAmount,
    amountOutUsd: null,
    priceImpactBps: q.price_impact ? Math.round(Number(q.price_impact) * 100) : null,
    gasUsd: null,
    netOutputUsd: null,
    raw: q,
    fetchedAt: Date.now(),
  };
}

export async function getAllRoutes(params: AggregatorParams): Promise<RouteQuote[]> {
  const isSolana = params.chain.toLowerCase() === "solana";

  // Solana → Jupiter is authoritative; handled in existing /api/swap/quote.
  if (isSolana) return [];

  const settled = await Promise.allSettled([
    oneinchToRoute(params),
    kyberToRoute(params),
    openoceanToRoute(params),
  ]);

  const routes: RouteQuote[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) routes.push(r.value);
  }

  // Sort by netOutputUsd if present, else by raw amountOut descending.
  routes.sort((a, b) => {
    const aScore = a.netOutputUsd ?? Number(a.amountOut ?? 0);
    const bScore = b.netOutputUsd ?? Number(b.amountOut ?? 0);
    return bScore - aScore;
  });

  return routes;
}
