"use client";

import { useEffect, useState } from "react";
import type { RouteQuote } from "@/lib/services/swap-aggregator";
import { ChevronDown, ChevronUp, Loader2, Zap } from "lucide-react";

interface RouteComparisonProps {
  chain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  onSelect?: (route: RouteQuote) => void;
  selectedProvider?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  "0x": "Matcha (0x)",
  jupiter: "Jupiter",
  "1inch": "1inch",
  kyberswap: "KyberSwap",
  openocean: "OpenOcean",
};

export function RouteComparison({
  chain,
  fromToken,
  toToken,
  amountIn,
  onSelect,
  selectedProvider,
}: RouteComparisonProps) {
  const [routes, setRoutes] = useState<RouteQuote[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromToken || !toToken || !amountIn || Number(amountIn) <= 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/swap/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chain, fromToken, toToken, amountIn }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { routes: RouteQuote[] };
        if (!cancelled) setRoutes(json.routes ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, fromToken, toToken, amountIn]);

  const best = routes[0];
  const bestNet = best?.netOutputUsd ?? Number(best?.amountOut ?? 0);

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-blue-400" />
          <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Routes</span>
          {routes.length > 0 && <span className="text-[10px] text-slate-600">{routes.length} found</span>}
        </div>
        <div className="flex items-center gap-2">
          {best && (
            <span className="text-xs font-mono text-white">
              {best.amountOut} <span className="text-slate-500 text-[10px]">{PROVIDER_LABELS[best.provider]}</span>
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-800 divide-y divide-slate-800/50">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={14} className="animate-spin text-blue-400" />
            </div>
          )}
          {error && <p className="px-4 py-3 text-xs text-red-400">{error}</p>}
          {!loading && routes.length === 0 && !error && (
            <p className="px-4 py-3 text-xs text-slate-500">No alternative routes found</p>
          )}
          {routes.map((r, i) => {
            const isBest = i === 0;
            const net = r.netOutputUsd ?? Number(r.amountOut);
            const diff = i === 0 ? 0 : net - bestNet;
            return (
              <button
                key={r.provider}
                onClick={() => onSelect?.(r)}
                className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition text-left ${
                  selectedProvider === r.provider ? "bg-blue-500/5" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{PROVIDER_LABELS[r.provider]}</span>
                  {isBest && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/30 font-bold">
                      BEST
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-300">{r.amountOut}</span>
                  {!isBest && diff !== 0 && (
                    <span className="text-[10px] font-mono text-red-400">
                      {diff.toFixed(4)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RouteComparison;
