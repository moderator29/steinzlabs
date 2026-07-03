import { getOneInchQuote } from "./oneinch";
import { getKyberswapQuote } from "./kyberswap";
import { getOpenOceanQuote } from "./openocean";
import { cacheWithFallback } from "@/lib/cache/redis";
import { resolveSwapToken, toBaseUnits } from "@/lib/market/swapTokenMeta";

// Quotes go stale fast; 12s collapses the common N-follower fan-out within a
// single cron tick (and across consecutive ticks when cron interval ≤ TTL)
// while still keeping route data fresh enough for the confirm-time re-quote.
const QUOTE_CACHE_TTL_SECONDS = 12;

// First-success race: once any aggregator returns we wait at most this long
// for the others. Caps tail latency at first-success + tail (~3.5s worst case
// vs ~3s × 3 with allSettled when providers respond at different rates).
const STRAGGLER_TAIL_MS = 500;

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

  // The individual aggregator services need CONTRACT ADDRESSES + BASE UNITS,
  // but callers pass symbols ('ETH') + a human amount ('0.5') — so every
  // route request returned nothing or wrong-magnitude numbers. Resolve once
  // here (same helpers the working /api/swap/price route uses) before fanning
  // out. Unknown tokens → no routes rather than a junk quote.
  const sell = resolveSwapToken(params.fromToken, params.chain);
  const buy = resolveSwapToken(params.toToken, params.chain);
  if (!sell || !buy) return [];
  const baseAmount = /^\d+$/.test(params.amountIn)
    ? params.amountIn
    : toBaseUnits(params.amountIn, sell.decimals);
  if (baseAmount === "0") return [];
  const resolved: AggregatorParams = {
    ...params,
    fromToken: sell.address,
    toToken: buy.address,
    amountIn: baseAmount,
  };

  const chainKey = params.chain.toLowerCase();
  const fromKey = sell.address.toLowerCase();
  const toKey = buy.address.toLowerCase();
  const slipKey = params.slippageBps ?? 0;
  const cacheKey = `swap:routes:${chainKey}:${fromKey}:${toKey}:${baseAmount}:${slipKey}`;

  return cacheWithFallback<RouteQuote[]>(cacheKey, QUOTE_CACHE_TTL_SECONDS, async () => {
    const calls = [oneinchToRoute(resolved), kyberToRoute(resolved), openoceanToRoute(resolved)];
    const routes: RouteQuote[] = [];
    const remaining = new Set<number>([0, 1, 2]);

    // Tag each promise with its index so the race result tells us which
    // provider returned first and we can drop it from the pending set.
    const tagged = calls.map((p, i) =>
      p.then(
        (value) => ({ i, value, ok: true as const }),
        (reason) => ({ i, reason, ok: false as const }),
      ),
    );

    // Phase 1: wait for the first SUCCESS (not the first settled — a fast
    // failure shouldn't unblock the tail window before any quote lands).
    while (remaining.size > 0 && routes.length === 0) {
      const winner = await Promise.race(
        Array.from(remaining).map((i) => tagged[i]),
      );
      remaining.delete(winner.i);
      if (winner.ok && winner.value) routes.push(winner.value);
    }

    // Phase 2: tail window. Take whatever stragglers complete within
    // STRAGGLER_TAIL_MS; abandon the rest (we already have one route, an
    // even-better one isn't worth doubling latency for).
    if (remaining.size > 0) {
      const tailPromise = Promise.all(
        Array.from(remaining).map((i) =>
          tagged[i].then((r) => {
            if (r.ok && r.value) routes.push(r.value);
          }),
        ),
      );
      const tailTimeout = new Promise<void>((resolve) =>
        setTimeout(resolve, STRAGGLER_TAIL_MS),
      );
      await Promise.race([tailPromise, tailTimeout]);
    }

    // Sort by netOutputUsd if present, else by raw amountOut descending.
    routes.sort((a, b) => {
      const aScore = a.netOutputUsd ?? Number(a.amountOut ?? 0);
      const bScore = b.netOutputUsd ?? Number(b.amountOut ?? 0);
      return bScore - aScore;
    });

    return routes;
  });
}
