import { NextRequest, NextResponse } from "next/server";
import { cacheWithFallback } from "@/lib/cache/redis";
import { fetchOhlcv, type OhlcvSource, type Timeframe } from "@/lib/services/ohlcv";

export const runtime = "nodejs";

const VALID_TF: ReadonlyArray<Timeframe> = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string; token: string }> },
) {
  const { chain, token } = await params;
  const sp = request.nextUrl.searchParams;
  const tfRaw = sp.get("tf") ?? "1h";
  const tf = (VALID_TF.includes(tfRaw as Timeframe) ? tfRaw : "1h") as Timeframe;
  const limit = Math.max(50, Math.min(1000, parseInt(sp.get("limit") ?? "500", 10) || 500));

  // Optional on-chain identity so a coin charted via a (volume-less)
  // CoinGecko slug can be routed to a real-volume source (GeckoTerminal
  // pool OHLCV). Only real values are forwarded — absent params leave the
  // slug/CoinGecko fallback untouched.
  const source: OhlcvSource = {
    network: sp.get("net") ?? undefined,
    address: sp.get("addr") ?? undefined,
    pair: sp.get("pair") ?? undefined,
  };
  const hasSource = !!(source.network && (source.pair || source.address));
  // Discriminate the cache so an address-routed (with-volume) result never
  // collides with a slug-only (volume-less) one for the same coin.
  const sourceKey = hasSource ? `:src:${source.network}:${source.pair ?? source.address}` : "";

  const cacheKey = `ohlcv:${chain}:${token}:${tf}:${limit}${sourceKey}`;
  const ttl = tf === "1m" ? 15 : tf === "5m" ? 30 : 60;

  try {
    const candles = await cacheWithFallback(cacheKey, ttl, () =>
      fetchOhlcv(chain, token, tf, limit, hasSource ? source : undefined),
    );
    return NextResponse.json(
      { candles, tf, count: candles.length },
      { headers: { "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl * 2}` } },
    );
  } catch (err) {
    console.error("[ohlcv]", err);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 502 });
  }
}
