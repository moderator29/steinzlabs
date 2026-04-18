import { NextRequest, NextResponse } from "next/server";
import { cacheWithFallback } from "@/lib/cache/redis";
import { fetchOhlcv, type Timeframe } from "@/lib/services/ohlcv";

export const runtime = "nodejs";

const VALID_TF: ReadonlyArray<Timeframe> = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string; token: string }> },
) {
  const { chain, token } = await params;
  const tfRaw = request.nextUrl.searchParams.get("tf") ?? "1h";
  const tf = (VALID_TF.includes(tfRaw as Timeframe) ? tfRaw : "1h") as Timeframe;
  const limit = Math.max(50, Math.min(1000, parseInt(request.nextUrl.searchParams.get("limit") ?? "500", 10) || 500));

  const cacheKey = `ohlcv:${chain}:${token}:${tf}:${limit}`;
  const ttl = tf === "1m" ? 15 : tf === "5m" ? 30 : 60;

  try {
    const candles = await cacheWithFallback(cacheKey, ttl, () =>
      fetchOhlcv(chain, token, tf, limit),
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
