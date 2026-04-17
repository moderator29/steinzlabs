import { NextResponse } from "next/server";
import { cacheWithFallback } from "@/lib/cache/redis";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export const revalidate = 120;
export const runtime = "nodejs";

interface CoinGeckoGlobal {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number };
    market_cap_change_percentage_24h_usd: number;
  };
}

export async function GET() {
  try {
    const data = await cacheWithFallback("dashboard:market-globals", 120, async () => {
      const res = await fetchWithRetry("https://api.coingecko.com/api/v3/global", {
        source: "coingecko-global",
        timeoutMs: 6000,
        retries: 2,
      });
      const json = (await res.json()) as CoinGeckoGlobal;
      return {
        totalMarketCap: json.data.total_market_cap.usd,
        totalVolume: json.data.total_volume.usd,
        btcDominance: json.data.market_cap_percentage.btc,
        volumeChange24h: json.data.market_cap_change_percentage_24h_usd ?? 0,
        marketCapChange24h: json.data.market_cap_change_percentage_24h_usd ?? 0,
        dominanceChange24h: 0,
        chainsTracked: 15,
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=120" },
    });
  } catch (err) {
    console.error("[market-globals]", err);
    return NextResponse.json({ error: "Failed to load market globals" }, { status: 502 });
  }
}
