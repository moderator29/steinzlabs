"use client";

import type { Timeframe } from "@/lib/services/ohlcv";
import type { ChartType, IndicatorConfig } from "@/components/trading/AdvancedChart";
import { BarChart3, CandlestickChart as CandleIcon, LineChart, AreaChart, Settings2 } from "lucide-react";
import { useState } from "react";

interface ChartToolbarProps {
  tf: Timeframe;
  chartType: ChartType;
  indicators: IndicatorConfig;
  onTfChange: (tf: Timeframe) => void;
  onChartTypeChange: (t: ChartType) => void;
  onIndicatorsChange: (i: IndicatorConfig) => void;
}

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];

const INDICATOR_OPTIONS: Array<{ key: keyof IndicatorConfig; label: string }> = [
  { key: "ema9", label: "EMA 9" },
  { key: "ema21", label: "EMA 21" },
  { key: "ema50", label: "EMA 50" },
  { key: "ema200", label: "EMA 200" },
  { key: "sma20", label: "SMA 20" },
  { key: "sma50", label: "SMA 50" },
  { key: "sma200", label: "SMA 200" },
  { key: "bollinger", label: "Bollinger" },
  { key: "vwap", label: "VWAP" },
  { key: "rsi", label: "RSI" },
  { key: "volume", label: "Volume" },
];

export function ChartToolbar({
  tf,
  chartType,
  indicators,
  onTfChange,
  onChartTypeChange,
  onIndicatorsChange,
}: ChartToolbarProps) {
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-800 bg-slate-900/40">
      {/* Timeframes */}
      <div className="flex items-center gap-0.5">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => onTfChange(t)}
            className={`text-[10px] font-mono uppercase px-1.5 py-1 rounded transition ${
              tf === t
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "text-slate-500 hover:text-white hover:bg-white/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-slate-800 mx-1" />

      {/* Chart type */}
      <div className="flex items-center gap-0.5">
        <IconButton active={chartType === "candlestick"} onClick={() => onChartTypeChange("candlestick")} title="Candlestick">
          <CandleIcon size={13} />
        </IconButton>
        <IconButton active={chartType === "line"} onClick={() => onChartTypeChange("line")} title="Line">
          <LineChart size={13} />
        </IconButton>
        <IconButton active={chartType === "area"} onClick={() => onChartTypeChange("area")} title="Area">
          <AreaChart size={13} />
        </IconButton>
        <IconButton active={chartType === "bars"} onClick={() => onChartTypeChange("bars")} title="Bars">
          <BarChart3 size={13} />
        </IconButton>
      </div>

      <div className="w-px h-4 bg-slate-800 mx-1" />

      {/* Indicators menu */}
      <div className="relative">
        <button
          onClick={() => setIndicatorsOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition"
        >
          <Settings2 size={12} />
          Indicators
          <span className="text-[9px] font-mono text-blue-400">
            {Object.values(indicators).filter(Boolean).length}
          </span>
        </button>
        {indicatorsOpen && (
          <div className="absolute top-full left-0 mt-1 w-44 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-30 p-1">
            {INDICATOR_OPTIONS.map(({ key, label }) => {
              const active = indicators[key];
              return (
                <button
                  key={key}
                  onClick={() => onIndicatorsChange({ ...indicators, [key]: !active })}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded hover:bg-white/5 text-left transition"
                >
                  <span className={active ? "text-white" : "text-slate-500"}>{label}</span>
                  <span className={`w-3 h-3 rounded border ${active ? "bg-blue-500/80 border-blue-400" : "border-slate-700"}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition ${
        active ? "bg-blue-500/20 text-blue-300" : "text-slate-500 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

export default ChartToolbar;
