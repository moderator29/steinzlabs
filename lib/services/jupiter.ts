import 'server-only';
import { cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * Jupiter Aggregator Service — Solana Swap Routing
 * Uses lite-api.jup.ag (no key required).
 * Quotes cached 15s, prices cached 30s.
 */

const QUOTE_URL = 'https://lite-api.jup.ag/swap/v1';
const PRICE_URL = 'https://api.jup.ag/price/v2';
const TIMEOUT_MS = parseInt(process.env.JUPITER_TIMEOUT_MS || '10000', 10);

// SOL mint address
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
// USDC mint address
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;         // lamports/raw units
  outAmount: string;        // lamports/raw units
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRoutePlan[];
  swapUsdValue?: string;
  // Raw response saved for swap transaction building
  _raw: unknown;
}

export interface JupiterRoutePlan {
  protocol: string;
  inputMint: string;
  outputMint: string;
  percent: number;
}

export interface JupiterSwapTransaction {
  swapTransaction: string;   // base64 serialized VersionedTransaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface JupiterTokenPrice {
  id: string;
  price: string;
  type: string;
}

async function jupiterFetch(url: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Jupiter error ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Get a swap quote from Jupiter.
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @param amountLamports - Amount in raw units (lamports for SOL, base units for tokens)
 * @param slippageBps - Slippage tolerance in basis points (default 50 = 0.5%)
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps = 50
): Promise<JupiterQuote | null> {
  const key = cacheKey('jupiter', 'quote', { inputMint, outputMint, amountLamports, slippageBps });
  return withCache(key, TTL.SWAP_ROUTE, async () => {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: String(amountLamports),
        slippageBps: String(slippageBps),
      });

      const data = await jupiterFetch(`${QUOTE_URL}/quote?${params}`) as Record<string, unknown>;

      return {
        inputMint: data.inputMint as string,
        outputMint: data.outputMint as string,
        inAmount: data.inAmount as string,
        outAmount: data.outAmount as string,
        otherAmountThreshold: data.otherAmountThreshold as string,
        swapMode: data.swapMode as string ?? 'ExactIn',
        slippageBps: data.slippageBps as number ?? slippageBps,
        priceImpactPct: data.priceImpactPct as string ?? '0',
        swapUsdValue: data.swapUsdValue as string | undefined,
        routePlan: ((data.routePlan as Record<string, unknown>[]) ?? []).map(step => {
          const info = step.swapInfo as Record<string, unknown> | undefined;
          return {
            protocol: info?.label as string ?? 'Jupiter',
            inputMint: info?.inputMint as string ?? inputMint,
            outputMint: info?.outputMint as string ?? outputMint,
            percent: step.percent as number ?? 100,
          };
        }),
        _raw: data,
      };
    } catch {
      return null;
    }
  });
}

/**
 * Build a serialized swap transaction from a quote.
 * Returns the base64 transaction for client-side signing.
 */
export async function buildSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string,
  options?: {
    prioritizationFeeLamports?: number | 'auto';
    dynamicComputeUnitLimit?: boolean;
    feeAccount?: string;        // Platform fee account
  }
): Promise<JupiterSwapTransaction | null> {
  try {
    const body: Record<string, unknown> = {
      quoteResponse: quote._raw,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: options?.dynamicComputeUnitLimit ?? true,
      prioritizationFeeLamports: options?.prioritizationFeeLamports ?? 'auto',
    };

    if (options?.feeAccount) {
      body.feeAccount = options.feeAccount;
    }

    const data = await jupiterFetch(`${QUOTE_URL}/swap`, {
      method: 'POST',
      body: JSON.stringify(body),
    }) as Record<string, unknown>;

    return {
      swapTransaction: data.swapTransaction as string,
      lastValidBlockHeight: data.lastValidBlockHeight as number ?? 0,
      prioritizationFeeLamports: data.prioritizationFeeLamports as number ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Get token price(s) from Jupiter Price API.
 */
export async function getTokenPrice(mintAddress: string): Promise<number> {
  const key = cacheKey('jupiter', 'price', { mintAddress });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    try {
      const data = await jupiterFetch(`${PRICE_URL}?ids=${mintAddress}`) as {
        data?: Record<string, { price: string }>
      };
      return parseFloat(data.data?.[mintAddress]?.price ?? '0');
    } catch {
      return 0;
    }
  });
}

/**
 * Get prices for multiple tokens in one call.
 */
export async function getTokenPrices(
  mintAddresses: string[]
): Promise<Record<string, number>> {
  if (mintAddresses.length === 0) return {};
  const key = cacheKey('jupiter', 'prices', { mints: mintAddresses.sort().join(',') });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    try {
      const ids = mintAddresses.join(',');
      const data = await jupiterFetch(`${PRICE_URL}?ids=${ids}`) as {
        data?: Record<string, { price: string }>
      };
      const result: Record<string, number> = {};
      for (const [mint, info] of Object.entries(data.data ?? {})) {
        result[mint] = parseFloat(info.price ?? '0');
      }
      return result;
    } catch {
      return {};
    }
  });
}

/**
 * Get a human-readable swap summary for display.
 */
export function formatQuoteSummary(quote: JupiterQuote, inputDecimals: number, outputDecimals: number): {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  route: string;
  minimumReceived: number;
} {
  const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
  const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
  const minimumReceived = parseInt(quote.otherAmountThreshold) / Math.pow(10, outputDecimals);
  const priceImpact = parseFloat(quote.priceImpactPct);
  const route = quote.routePlan.map(r => r.protocol).join(' → ');

  return { inputAmount, outputAmount, priceImpact, route, minimumReceived };
}
