import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

const CHAIN_SLUGS: Record<string, string> = {
  ethereum: "eth",
  bsc: "bsc",
  polygon: "polygon",
  optimism: "optimism",
  arbitrum: "arbitrum",
  base: "base",
  avalanche: "avax",
};

export interface OpenOceanQuote {
  outAmount?: string;
  estimatedGas?: string;
  price_impact?: string;
  data?: unknown;
}

export async function getOpenOceanQuote(params: {
  chain: string;
  fromToken: string;
  toToken: string;
  amount: string;
}): Promise<OpenOceanQuote | null> {
  const slug = CHAIN_SLUGS[params.chain.toLowerCase()];
  if (!slug) return null;
  try {
    const url = `https://open-api.openocean.finance/v4/${slug}/quote?inTokenAddress=${params.fromToken}&outTokenAddress=${params.toToken}&amount=${params.amount}&gasPrice=5`;
    const res = await fetchWithRetry(url, { source: "openocean-quote", timeoutMs: 5000, retries: 2 });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: number; data?: OpenOceanQuote };
    if (json.code !== 200) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}
