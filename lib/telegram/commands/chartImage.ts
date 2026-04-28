import "server-only";
import { getCoinMarketChart } from "@/lib/services/coingecko";

/**
 * Build a chart image URL for use in Telegram's sendPhoto.
 *
 * We render via QuickChart (https://quickchart.io) — a hosted Chart.js
 * renderer that accepts a config in the URL and returns a PNG. No
 * dependencies, no rendering work in our serverless function, and Telegram
 * happily fetches the image directly from QuickChart.
 *
 * If QuickChart is ever down or rate-limited, the caller can fall back
 * to a text-only price card.
 */

const QUICKCHART_BASE = "https://quickchart.io/chart";

export async function buildPriceChartUrl(coinId: string, days = 1, symbol = "TOKEN"): Promise<string | null> {
  try {
    const points = await getCoinMarketChart(coinId, days);
    if (!points.length) return null;

    // Downsample to ~60 points for cleaner chart, smaller URL.
    const step = Math.max(1, Math.floor(points.length / 60));
    const sampled = points.filter((_, i) => i % step === 0);

    const labels = sampled.map(p => {
      const d = new Date(p.t);
      return days <= 1 ? `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}` : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    });
    const data = sampled.map(p => Number(p.price.toFixed(p.price > 1 ? 2 : 8)));

    const first = data[0] ?? 0;
    const last = data[data.length - 1] ?? 0;
    const up = last >= first;
    const lineColor = up ? "rgb(16,185,129)" : "rgb(239,68,68)";
    const fillColor = up ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";

    const config = {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: symbol,
          data,
          fill: true,
          backgroundColor: fillColor,
          borderColor: lineColor,
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.25,
        }],
      },
      options: {
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `${symbol} · ${days <= 1 ? "24h" : `${days}d`}`,
            color: "#ffffff",
            font: { size: 18, weight: "bold" },
          },
        },
        scales: {
          x: {
            ticks: { color: "rgba(255,255,255,0.6)", maxTicksLimit: 6 },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
          y: {
            ticks: {
              color: "rgba(255,255,255,0.6)",
              callback: "function(v){return v>=1?('$'+v.toLocaleString()):('$'+v.toFixed(6))}",
            },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
        },
      },
    };

    const url = new URL(QUICKCHART_BASE);
    url.searchParams.set("c", JSON.stringify(config));
    url.searchParams.set("backgroundColor", "rgb(7,9,15)");
    url.searchParams.set("width", "800");
    url.searchParams.set("height", "450");
    url.searchParams.set("devicePixelRatio", "2.0");

    const final = url.toString();
    // Telegram has a 2048-char limit on photo URLs. If we ever overshoot,
    // POST to QuickChart's /chart/create endpoint and use the returned
    // short URL — but at 60 points we're well under the limit.
    if (final.length > 2000) {
      console.warn(`[telegram.chart] URL too long (${final.length}), consider /chart/create`);
      return null;
    }
    return final;
  } catch (err) {
    console.error("[telegram.chart] build failed:", err);
    return null;
  }
}
