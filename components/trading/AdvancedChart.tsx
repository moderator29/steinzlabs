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
   * §11.2 — when true, the chart renders as a clean visual only:
   * crosshair, mouse wheel, pan, and pinch are disabled. Used by the
   * VTX agent's TokenCard so the inline preview can't be accidentally
   * dragged or zoomed by users scrolling the chat thread.
   */
  staticChart?: boolean;
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
  staticChart = false,
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
