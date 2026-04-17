"use client";

import { useState } from "react";
import { AdvancedChart, type ChartType, type IndicatorConfig } from "@/components/trading/AdvancedChart";
import { ChartToolbar } from "@/components/trading/ChartToolbar";
import { OrderForm } from "@/components/trading/OrderForm";
import { PositionsPanel } from "@/components/trading/PositionsPanel";
import { OpenOrdersPanel } from "@/components/trading/OpenOrdersPanel";
import { OrderHistoryPanel } from "@/components/trading/OrderHistoryPanel";
import { DcaBotsPanel } from "@/components/trading/DcaBotsPanel";
import { StopLossPanel } from "@/components/trading/StopLossPanel";
import type { Timeframe } from "@/lib/services/ohlcv";
import { ChevronDown, ChevronUp } from "lucide-react";

type BottomTab = "orders" | "history" | "positions" | "dca" | "stop";

const DEFAULT_CHAIN = "ethereum";
const DEFAULT_TOKEN = "bitcoin";

export function TradingTerminalLayout() {
  const [chain, setChain] = useState<string>(DEFAULT_CHAIN);
  const [token, setToken] = useState<string>(DEFAULT_TOKEN);
  const [symbol, setSymbol] = useState<string>("BTC");
  const [tf, setTf] = useState<Timeframe>("1h");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [indicators, setIndicators] = useState<IndicatorConfig>({ ema21: true, ema50: true, volume: true });
  const [bottomTab, setBottomTab] = useState<BottomTab>("orders");
  const [bottomOpen, setBottomOpen] = useState(true);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#0A0E1A] text-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/30">
        <TokenSelector
          chain={chain}
          token={token}
          symbol={symbol}
          onChange={(c, t, s) => {
            setChain(c);
            setToken(t);
            setSymbol(s);
          }}
        />
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400">
          <Stat label="24h" value="—" />
          <Stat label="Vol" value="—" />
          <Stat label="MCap" value="—" />
          <Stat label="Liq" value="—" />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <ChartToolbar
            tf={tf}
            chartType={chartType}
            indicators={indicators}
            onTfChange={setTf}
            onChartTypeChange={setChartType}
            onIndicatorsChange={setIndicators}
          />
          <div className="flex-1 min-h-[300px] relative">
            <AdvancedChart
              chain={chain}
              token={token}
              tf={tf}
              chartType={chartType}
              indicators={indicators}
              height={400}
            />
          </div>
        </div>
        <div className="lg:w-[360px] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col min-h-0">
          <OrderForm
            chain={chain}
            tokenAddress={token}
            tokenSymbol={symbol}
          />
        </div>
      </div>

      {/* Bottom panel */}
      <div className={`border-t border-slate-800 bg-slate-900/30 transition-all ${bottomOpen ? "h-[220px]" : "h-10"}`}>
        <div className="flex items-center justify-between px-3 h-10 border-b border-slate-800">
          <div className="flex items-center gap-1">
            {(["orders", "history", "positions", "dca", "stop"] as BottomTab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setBottomTab(t);
                  setBottomOpen(true);
                }}
                className={`text-[11px] uppercase tracking-wide px-3 py-1.5 rounded transition ${
                  bottomTab === t && bottomOpen
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {t === "orders" ? "Open orders" : t === "dca" ? "DCA bots" : t === "stop" ? "Stop/TP" : t}
              </button>
            ))}
          </div>
          <button
            onClick={() => setBottomOpen((v) => !v)}
            className="p-1 text-slate-500 hover:text-white transition"
            aria-label={bottomOpen ? "Collapse panel" : "Expand panel"}
          >
            {bottomOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
        {bottomOpen && (
          <div className="h-[calc(100%-2.5rem)] overflow-auto">
            {bottomTab === "orders" && <OpenOrdersPanel />}
            {bottomTab === "history" && <OrderHistoryPanel />}
            {bottomTab === "positions" && <PositionsPanel />}
            {bottomTab === "dca" && <DcaBotsPanel />}
            {bottomTab === "stop" && <StopLossPanel />}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-600 mr-1.5">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function TokenSelector({
  chain,
  token,
  symbol,
  onChange,
}: {
  chain: string;
  token: string;
  symbol: string;
  onChange: (chain: string, token: string, symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const presets = [
    { chain: "ethereum", token: "bitcoin", symbol: "BTC" },
    { chain: "ethereum", token: "ethereum", symbol: "ETH" },
    { chain: "ethereum", token: "solana", symbol: "SOL" },
    { chain: "ethereum", token: "binancecoin", symbol: "BNB" },
    { chain: "ethereum", token: "arbitrum", symbol: "ARB" },
    { chain: "base", token: "base", symbol: "BASE" },
  ];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition"
      >
        <span className="text-white">{symbol}</span>
        <span className="text-[10px] uppercase text-slate-500">{chain}</span>
        <ChevronDown size={13} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-20">
          {presets.map((p) => (
            <button
              key={`${p.chain}:${p.token}`}
              onClick={() => {
                onChange(p.chain, p.token, p.symbol);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-white/5 text-left"
            >
              <span className="text-white font-semibold">{p.symbol}</span>
              <span className="text-slate-500 uppercase">{p.chain}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TradingTerminalLayout;
