import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  optimism: 10,
  arbitrum: 42161,
  base: 8453,
  avalanche: 43114,
};

export interface OneInchQuote {
  toAmount: string;
  fromToken: { address: string; symbol: string; decimals: number };
  toToken: { address: string; symbol: string; decimals: number };
  protocols?: unknown;
  estimatedGas?: number;
}

export async function getOneInchQuote(params: {
  chain: string;
  fromToken: string;
  toToken: string;
  amount: string;
}): Promise<OneInchQuote | null> {
  const chainId = CHAIN_IDS[params.chain.toLowerCase()];
  if (!chainId) return null;
  const key = process.env.ONEINCH_API_KEY;
  try {
    const url = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${params.fromToken}&dst=${params.toToken}&amount=${params.amount}&includeGas=true`;
    const res = await fetchWithRetry(url, {
      source: "1inch-quote",
      timeoutMs: 5000,
      retries: 2,
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
    if (!res.ok) return null;
    return (await res.json()) as OneInchQuote;
  } catch {
    return null;
  }
}
