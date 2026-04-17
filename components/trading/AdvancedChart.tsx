"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type HistogramData,
} from "lightweight-charts";
import type { Candle, Timeframe } from "@/lib/services/ohlcv";
import { ema, sma, bollinger, vwap, rsi } from "@/lib/trading/indicators";
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
}: AdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/market/ohlcv/${encodeURIComponent(chain)}/${encodeURIComponent(token)}?tf=${tf}&limit=500`);
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
  }, [chain, token, tf]);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const container = containerRef.current;

    const chart: IChartApi = createChart(container, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, monospace" },
      grid: { vertLines: { color: "rgba(148,163,184,0.06)" }, horzLines: { color: "rgba(148,163,184,0.06)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.1)", scaleMargins: { top: 0.1, bottom: indicators.volume ? 0.25 : 0.05 } },
      timeScale: { borderColor: "rgba(148,163,184,0.1)", timeVisible: true, secondsVisible: tf === "1m" },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(77,128,255,0.5)", style: LineStyle.Dashed, labelBackgroundColor: BRAND_BLUE },
        horzLine: { color: "rgba(77,128,255,0.5)", style: LineStyle.Dashed, labelBackgroundColor: BRAND_BLUE },
      },
      width: container.clientWidth,
      height,
      autoSize: true,
    });

    let mainSeries: ISeriesApi<"Candlestick" | "Line" | "Area" | "Bar">;
    if (chartType === "candlestick") {
      const s = chart.addCandlestickSeries({
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
      const s = chart.addBarSeries({ upColor: BRAND_UP, downColor: BRAND_DOWN });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
      mainSeries = s;
    } else if (chartType === "area") {
      const s = chart.addAreaSeries({ lineColor: BRAND_BLUE, topColor: "rgba(77,128,255,0.3)", bottomColor: "rgba(77,128,255,0)" });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
      mainSeries = s;
    } else {
      const s = chart.addLineSeries({ color: BRAND_BLUE, lineWidth: 2 });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
      mainSeries = s;
    }

    if (indicators.volume) {
      const volumeSeries = chart.addHistogramSeries({
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
      const s = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
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
    if (indicators.rsi) addLineOverlay(rsi(candles, 14), "#eab308");

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
  }, [candles, chartType, indicators, height, tf, onPriceClick]);

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
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default AdvancedChart;
