import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

const CHAIN_SLUGS: Record<string, string> = {
  ethereum: "ethereum",
  bsc: "bsc",
  polygon: "polygon",
  optimism: "optimism",
  arbitrum: "arbitrum",
  base: "base",
  avalanche: "avalanche",
};

export interface KyberswapQuote {
  outputAmount: string;
  amountInUsd?: string;
  amountOutUsd?: string;
  gas?: string;
  gasUsd?: string;
  routeSummary?: unknown;
}

export async function getKyberswapQuote(params: {
  chain: string;
  fromToken: string;
  toToken: string;
  amount: string;
}): Promise<KyberswapQuote | null> {
  const slug = CHAIN_SLUGS[params.chain.toLowerCase()];
  if (!slug) return null;
  try {
    const url = `https://aggregator-api.kyberswap.com/${slug}/api/v1/routes?tokenIn=${params.fromToken}&tokenOut=${params.toToken}&amountIn=${params.amount}`;
    const res = await fetchWithRetry(url, { source: "kyberswap-quote", timeoutMs: 5000, retries: 2 });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { routeSummary?: KyberswapQuote } };
    return json.data?.routeSummary ?? null;
  } catch {
    return null;
  }
}
