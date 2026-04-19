import { NextResponse } from "next/server";
import { getGlobalMarketData } from "@/lib/services/coingecko";

export const revalidate = 120;
export const runtime = "nodejs";

// Thin wrapper around the unified CoinGecko service so the dashboard gets the
// same cache + usage counter + Demo/Pro header handling as everyone else.
export async function GET() {
  try {
    const g = await getGlobalMarketData();
    return NextResponse.json({
      totalMarketCap: g.totalMarketCapUSD,
      totalVolume: g.totalVolumeUSD,
      btcDominance: g.btcDominancePercent,
      volumeChange24h: g.marketCapChange24hPercent,
      marketCapChange24h: g.marketCapChange24hPercent,
      dominanceChange24h: 0,
      chainsTracked: g.activeCryptocurrencies,
    }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=120" },
    });
  } catch (err) {
    console.error("[market-globals]", err);
    return NextResponse.json({ error: "Failed to load market globals" }, { status: 502 });
  }
}
