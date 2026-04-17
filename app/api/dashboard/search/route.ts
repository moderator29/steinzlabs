import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";
import { cacheWithFallback } from "@/lib/cache/redis";

export const runtime = "nodejs";

interface SearchResult {
  type: "token" | "wallet" | "entity";
  id?: string;
  address?: string;
  chain?: string;
  label: string;
  subLabel?: string;
}

interface CoinGeckoSearchCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
}

function isSolanaAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const results: SearchResult[] = [];

  if (isAddress(q)) {
    results.push({
      type: "wallet",
      address: q,
      chain: "evm",
      label: q,
      subLabel: "EVM wallet",
    });
  } else if (isSolanaAddress(q) && q.length >= 32 && q.length <= 44) {
    results.push({
      type: "wallet",
      address: q,
      chain: "solana",
      label: q,
      subLabel: "Solana wallet",
    });
  }

  try {
    const cgResults = await cacheWithFallback<CoinGeckoSearchCoin[]>(
      `search:cg:${q.toLowerCase()}`,
      300,
      async () => {
        const res = await fetchWithRetry(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
          { source: "coingecko-search", timeoutMs: 5000, retries: 2 },
        );
        const json = (await res.json()) as { coins?: CoinGeckoSearchCoin[] };
        return (json.coins ?? []).slice(0, 8);
      },
    );

    for (const coin of cgResults) {
      results.push({
        type: "token",
        id: coin.id,
        label: `${coin.name} (${coin.symbol.toUpperCase()})`,
        subLabel: coin.market_cap_rank ? `#${coin.market_cap_rank}` : undefined,
      });
    }
  } catch (err) {
    console.error("[dashboard/search] coingecko failed", err);
  }

  return NextResponse.json({ results });
}
