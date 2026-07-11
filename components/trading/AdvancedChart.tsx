"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  LineStyle,
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type HistogramData,
} from "lightweight-charts";
import type { Candle, Timeframe } from "@/lib/services/ohlcv";
import { ema, sma, bollinger, vwap, rsi, macd } from "@/lib/trading/indicators";
import { Loader2 } from "lucide-react";

export type ChartType = "candlestick" | "line" | "area" | "bars";

export interface IndicatorConfig {
  ema9?: boolean;
  ema21?: boolean;
  ema50?: boolean;
  ema200?: boolean;
  sma20?: boolean;
  sma50?: boolean;
  sma200?: boolean;
  bollinger?: boolean;
  vwap?: boolean;
  rsi?: boolean;
  macd?: boolean;
  volume?: boolean;
}

interface AdvancedChartProps {
  chain: string;
  token: string;
  tf: Timeframe;
  chartType?: ChartType;
  indicators?: IndicatorConfig;
  height?: number;
  className?: string;
  onPriceClick?: (price: number) => void;
  /**
   * §3 P2-A.3 — comparison overlay. When provided, a second token's
   * close-price series is fetched and overlaid on its own % -normalized
   * scale (both series rebased to 0% at the first candle of the visible
   * range). Lets users compare BTC vs ETH (or any two tokens) on the
   * same chart.
   */
  compareToken?: { chain: string; token: string; label?: string; color?: string };
  /**
   * §3 P2-A.6 — when true, an overlay "Save" button is rendered in the
   * top-right that takes a screenshot via lightweight-charts'
   * takeScreenshot(), stamps a NakaLabs watermark, and downloads as PNG.
   */
  enableSaveImage?: boolean;
  /**
   * §3 P2-A.4 — replay mode. When set, the chart only renders candles
   * up to (and including) this index. Caller drives the scrubber via
   * ReplayControls so the chart stays stateless about playback.
   */
  replayIndex?: number;
  /**
   * §11.2 — when true, the chart renders as a clean visual only:
   * crosshair, mouse wheel, pan, and pinch are disabled. Used by the
   * VTX agent's TokenCard so the inline preview can't be accidentally
   * dragged or zoomed by users scrolling the chat thread.
   */
  staticChart?: boolean;
  /**
   * Volume-source hint. When `token` is a (volume-less) CoinGecko slug but
   * the coin has a known on-chain contract/pool, pass its real network +
   * contract/pair so the OHLCV route fetches REAL per-bar volume from
   * GeckoTerminal instead of CoinGecko's volume-less /ohlc. Omitted for
   * coins with no on-chain identity — the volume pane then stays honestly
   * empty rather than showing fabricated bars.
   */
  volumeNetwork?: string;
  volumeAddress?: string;
  volumePair?: string;
}

const BRAND_UP = "#22c55e";
const BRAND_DOWN = "#ef4444";
const BRAND_BLUE = "#4d80ff";

const EMA_COLORS: Record<string, string> = {
  ema9: "#f59e0b",
  ema21: "#06b6d4",
  ema50: "#a855f7",
  ema200: "#ec4899",
  sma20: "#eab308",
  sma50: "#14b8a6",
  sma200: "#f43f5e",
};

export function AdvancedChart({
  chain,
  token,
  tf,
  chartType = "candlestick",
  indicators = { ema21: true, ema50: true, volume: true },
  height = 420,
  className = "",
  onPriceClick,
  compareToken,
  enableSaveImage = false,
  replayIndex,
  staticChart = false,
  volumeNetwork,
  volumeAddress,
  volumePair,
}: AdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [allCandles, setAllCandles] = useState<Candle[]>([]);
  // Active series for the renderer respects replay truncation when set.
  const candles =
    typeof replayIndex === "number" && replayIndex >= 0 && replayIndex < allCandles.length
      ? allCandles.slice(0, replayIndex + 1)
      : allCandles;
  const setCandles = setAllCandles;
  const [compareCandles, setCompareCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const qs = new URLSearchParams({ tf, limit: "500" });
        // Real-volume routing: forward the coin's on-chain identity so the
        // OHLCV route can prefer GeckoTerminal (which returns volume) over a
        // volume-less CoinGecko slug. Absent hints → route falls back to CG.
        if (volumeNetwork) qs.set("net", volumeNetwork);
        if (volumeAddress) qs.set("addr", volumeAddress);
        if (volumePair) qs.set("pair", volumePair);
        const res = await fetch(`/api/market/ohlcv/${encodeURIComponent(chain)}/${encodeURIComponent(token)}?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { candles: Candle[] };
        if (!cancelled) setCandles(json.candles);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load chart");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, token, tf, volumeNetwork, volumeAddress, volumePair]);

  // §3 P2-A.3 — pull the comparison token's candles on the same tf so
  // both series can be rebased to % change in the render effect.
  useEffect(() => {
    if (!compareToken) {
      setCompareCandles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/market/ohlcv/${encodeURIComponent(compareToken.chain)}/${encodeURIComponent(compareToken.token)}?tf=${tf}&limit=500`);
        if (!res.ok) return;
        const json = (await res.json()) as { candles: Candle[] };
        if (!cancelled) setCompareCandles(json.candles ?? []);
      } catch { /* leave empty — overlay just won't render */ }
    })();
    return () => { cancelled = true; };
  }, [compareToken, tf]);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const container = containerRef.current;

    const chart: IChartApi = createChart(container, {
      layout: { attributionLogo: false, background: { color: "transparent" }, textColor: "#94a3b8", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, monospace" },
      grid: { vertLines: { color: "rgba(148,163,184,0.06)" }, horzLines: { color: "rgba(148,163,184,0.06)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.1)", scaleMargins: { top: 0.1, bottom: indicators.volume ? 0.25 : 0.05 } },
      timeScale: { borderColor: "rgba(148,163,184,0.1)", timeVisible: true, secondsVisible: tf === "1m" },
      crosshair: staticChart
        ? { mode: CrosshairMode.Hidden }
        : {
            mode: CrosshairMode.Normal,
            vertLine: { color: "rgba(77,128,255,0.5)", style: LineStyle.Dashed, labelBackgroundColor: BRAND_BLUE },
            horzLine: { color: "rgba(77,128,255,0.5)", style: LineStyle.Dashed, labelBackgroundColor: BRAND_BLUE },
          },
      // §11.2 — disable every interaction primitive when staticChart is on
      // so the VTX inline preview reads as art, not a controllable widget.
      handleScroll: !staticChart,
      handleScale: !staticChart,
      kineticScroll: { touch: !staticChart, mouse: !staticChart },
      width: container.clientWidth,
      height,
      autoSize: true,
    });
    chartRef.current = chart;

    let mainSeries: ISeriesApi<"Candlestick" | "Line" | "Area" | "Bar">;
    if (chartType === "candlestick") {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: BRAND_UP,
        downColor: BRAND_DOWN,
        borderUpColor: BRAND_UP,
        borderDownColor: BRAND_DOWN,
        wickUpColor: BRAND_UP,
        wickDownColor: BRAND_DOWN,
      });
      const data: CandlestickData[] = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      s.setData(data);
      mainSeries = s;
    } else if (chartType === "bars") {
      const s = chart.addSeries(BarSeries, { upColor: BRAND_UP, downColor: BRAND_DOWN });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
      mainSeries = s;
    } else if (chartType === "area") {
      const s = chart.addSeries(AreaSeries, { lineColor: BRAND_BLUE, topColor: "rgba(77,128,255,0.3)", bottomColor: "rgba(77,128,255,0)" });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
      mainSeries = s;
    } else {
      const s = chart.addSeries(LineSeries, { color: BRAND_BLUE, lineWidth: 2 });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
      mainSeries = s;
    }

    if (indicators.volume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "rgba(77,128,255,0.4)",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      const vData: HistogramData[] = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
      }));
      volumeSeries.setData(vData);
    }

    function addLineOverlay(points: { time: number; value: number }[], color: string) {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) as LineData[]);
    }

    if (indicators.ema9) addLineOverlay(ema(candles, 9), EMA_COLORS.ema9);
    if (indicators.ema21) addLineOverlay(ema(candles, 21), EMA_COLORS.ema21);
    if (indicators.ema50) addLineOverlay(ema(candles, 50), EMA_COLORS.ema50);
    if (indicators.ema200) addLineOverlay(ema(candles, 200), EMA_COLORS.ema200);
    if (indicators.sma20) addLineOverlay(sma(candles, 20), EMA_COLORS.sma20);
    if (indicators.sma50) addLineOverlay(sma(candles, 50), EMA_COLORS.sma50);
    if (indicators.sma200) addLineOverlay(sma(candles, 200), EMA_COLORS.sma200);
    if (indicators.bollinger) {
      const bb = bollinger(candles, 20, 2);
      addLineOverlay(bb.upper, "rgba(148,163,184,0.5)");
      addLineOverlay(bb.lower, "rgba(148,163,184,0.5)");
    }
    if (indicators.vwap) addLineOverlay(vwap(candles), "#a855f7");

    // §3 P2-A.3 — comparison overlay. Both the main series and the
    // compare series are rebased to % change from the first candle so
    // they share a unified scale. We attach the compare series to a
    // dedicated 'compare' left price scale formatted as percentage.
    if (compareToken && compareCandles.length > 0) {
      const cmpColor = compareToken.color ?? "#a855f7";
      const baseFirst = candles[0]?.close ?? 0;
      const cmpFirst = compareCandles[0]?.close ?? 0;
      if (baseFirst > 0 && cmpFirst > 0) {
        const cmpSeries = chart.addSeries(LineSeries, {
          color: cmpColor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceScaleId: "compare",
          title: compareToken.label ?? "Compare",
          priceFormat: { type: "custom", formatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, minMove: 0.01 },
        });
        cmpSeries.setData(
          compareCandles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: ((c.close - cmpFirst) / cmpFirst) * 100,
          })),
        );
        chart.priceScale("compare").applyOptions({
          visible: true,
          borderColor: "rgba(148,163,184,0.1)",
          scaleMargins: { top: 0.1, bottom: indicators.volume ? 0.25 : 0.05 },
        });
      }
    }

    // §3 P2-A.1 — RSI + MACD render as dedicated panes below the price
    // pane (lightweight-charts v5 panes API), not overlaid on the price
    // scale. RSI gets a 0-100 scale with 30/70 reference lines; MACD
    // gets a zero-centered scale with histogram + signal lines. Each pane
    // shares the main chart's time scale so panning + zoom stay in sync.
    if (indicators.rsi) {
      const rsiPaneIndex = chart.panes().length;
      const rsiSeries = chart.addSeries(LineSeries, {
        color: "#eab308",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
      }, rsiPaneIndex);
      rsiSeries.setData(rsi(candles, 14).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const rsiPane = chart.panes()[rsiPaneIndex];
      if (rsiPane) rsiPane.setHeight(80);
      rsiSeries.createPriceLine({ price: 70, color: "rgba(239,68,68,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
      rsiSeries.createPriceLine({ price: 30, color: "rgba(34,197,94,0.5)",  lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
    }
    if (indicators.macd) {
      const m = macd(candles, 12, 26, 9);
      const macdPaneIndex = chart.panes().length;
      const histSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
        priceLineVisible: false,
        lastValueVisible: false,
      }, macdPaneIndex);
      histSeries.setData(m.histogram.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
        color: p.value >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
      })));
      const macdLine = chart.addSeries(LineSeries, { color: "#4d80ff", lineWidth: 1, priceLineVisible: false, lastValueVisible: true }, macdPaneIndex);
      macdLine.setData(m.macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const signalLine = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: true }, macdPaneIndex);
      signalLine.setData(m.signal.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const macdPane = chart.panes()[macdPaneIndex];
      if (macdPane) macdPane.setHeight(100);
    }

    if (onPriceClick) {
      chart.subscribeClick((param) => {
        if (!param.point) return;
        const price = mainSeries.coordinateToPrice(param.point.y);
        if (typeof price === "number" && Number.isFinite(price)) onPriceClick(price);
      });
    }

    return () => {
      chart.remove();
    };
    // `indicators` is an inline object literal from the parent, so its identity
    // changes on every parent render. Depending on it directly tore down and
    // recreated the whole chart (flicker) on unrelated re-renders. Serializing
    // the config gives a stable primitive that only changes when a toggle
    // actually flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, compareCandles, compareToken, chartType, JSON.stringify(indicators), height, tf, onPriceClick, staticChart, replayIndex]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm z-10">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 z-10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {/* Honest empty state. The OHLCV source returned no candles (no DEX pair
          or no history yet). Show a clear note instead of a silent blank panel;
          never synthesize fake candles to fill the space. */}
      {!loading && !error && candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 px-4 text-center">
          <p className="text-sm text-slate-500">No chart data available for this token yet.</p>
        </div>
      )}
      {enableSaveImage && (
        <button
          type="button"
          onClick={() => downloadChartImage(chartRef.current, `${token}-${tf}.png`)}
          className="absolute top-2 right-12 z-20 px-2 py-1 rounded-md bg-slate-900/70 hover:bg-slate-800 border border-white/10 text-[10px] uppercase tracking-wider text-slate-300"
          aria-label="Save chart as image"
        >
          Save PNG
        </button>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// §3 P2-A.6 — chart-to-PNG with NakaLabs watermark stamped on top.
// Uses lightweight-charts' takeScreenshot() (returns an HTMLCanvasElement)
// then draws the watermark text in the corner before triggering download.
function downloadChartImage(chart: IChartApi | null, filename: string) {
  if (!chart) return;
  const source = chart.takeScreenshot();
  // Build a working canvas so we can compose the watermark without
  // mutating the chart's own pixel buffer.
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(source, 0, 0);

  const padding = 16;
  ctx.font = "bold 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(77, 128, 255, 0.85)";
  ctx.fillText("NAKALABS", padding, out.height - padding - 16);
  ctx.font = "11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont";
  ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
  ctx.fillText("nakalabs.xyz", padding, out.height - padding);

  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

export default AdvancedChart;
