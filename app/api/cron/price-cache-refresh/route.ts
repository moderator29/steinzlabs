import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { cacheSet } from "@/lib/cache/redis";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "price-cache-refresh";

interface CgMarketRow {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let cached = 0;
  try {
    // Top 100 tokens from CoinGecko
    const res = await fetchWithRetry(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h",
      { source: "coingecko-markets", timeoutMs: 8000, retries: 2 },
    );
    if (!res.ok) throw new Error(`coingecko markets HTTP ${res.status}`);
    const rows = (await res.json()) as CgMarketRow[];

    for (const row of rows) {
      const payload = {
        id: row.id,
        symbol: row.symbol,
        price: row.current_price,
        change24h: row.price_change_percentage_24h ?? 0,
        marketCap: row.market_cap,
        volume24h: row.total_volume,
        fetchedAt: Date.now(),
      };
      await cacheSet(`price:cg:${row.id}`, payload, 300);
      await cacheSet(`price:sym:${row.symbol.toLowerCase()}`, payload, 300);
      cached++;
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, cached);
    return NextResponse.json({ ok: true, durationMs: duration, cached });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, cached);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
