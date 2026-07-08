import { NextResponse } from "next/server";
import { getGlobalMarketData } from "@/lib/services/coingecko";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Thin wrapper around the unified CoinGecko service so the dashboard gets
// the same cache + usage counter + Demo/Pro header handling as everyone
// else. 10 s function ceiling + 8 s race ensures the dashboard never has
// to wait on a hung Vercel lambda after the 2026-04-19 Upstash blip pattern.
async function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try { return await Promise.race([p, t]); } finally { if (timer) clearTimeout(timer); }
}

export async function GET() {
  try {
    const g = await withDeadline(getGlobalMarketData(), 8000, {
      totalMarketCapUSD: 0, totalVolumeUSD: 0, btcDominancePercent: 0,
      marketCapChange24hPercent: 0, activeCryptocurrencies: 0,
    });
    return NextResponse.json({
      totalMarketCap: g.totalMarketCapUSD,
      totalVolume: g.totalVolumeUSD,
      btcDominance: g.btcDominancePercent,
      // Data honesty (owner audit): CoinGecko /global exposes ONLY the
      // 24h market-cap change %. It does NOT expose a 24h *volume* change
      // or a 24h *dominance* change. The previous code copied the
      // market-cap change into volumeChange24h (a wrong, misleading
      // number) and hardcoded dominanceChange24h to 0 (a fabricated
      // "flat" reading). Both are now null so consumers render "—"
      // instead of an invented value.
      volumeChange24h: null,
      marketCapChange24h: g.marketCapChange24hPercent,
      dominanceChange24h: null,
      // NOTE: this is active *cryptocurrencies* (coin count), not chains.
      activeCryptocurrencies: g.activeCryptocurrencies,
      chainsTracked: g.activeCryptocurrencies,
    }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=120" },
    });
  } catch (err) {
    console.error("[market-globals]", err);
    return NextResponse.json({ error: "Failed to load market globals" }, { status: 502 });
  }
}
