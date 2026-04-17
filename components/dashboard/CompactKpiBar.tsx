"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Globe, DollarSign, BarChart3 } from "lucide-react";

interface MarketGlobals {
  totalMarketCap: number;
  totalVolume: number;
  btcDominance: number;
  volumeChange24h: number;
  marketCapChange24h: number;
  dominanceChange24h: number;
  chainsTracked: number;
}

export function CompactKpiBar() {
  const [data, setData] = useState<MarketGlobals | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/market-globals");
        if (!res.ok) return;
        const json = (await res.json()) as MarketGlobals;
        if (!cancelled) setData(json);
      } catch {
        /* network error — leave previous data in place */
      }
    }
    load();
    const interval = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const fmt = (n: number) =>
    n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(2)}M`;

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 py-2 border-b border-slate-800/50">
      <KpiPill
        icon={<DollarSign size={12} />}
        label="Market Cap"
        value={data ? fmt(data.totalMarketCap) : "—"}
        change={data?.marketCapChange24h ?? null}
      />
      <KpiPill
        icon={<BarChart3 size={12} />}
        label="24h Vol"
        value={data ? fmt(data.totalVolume) : "—"}
        change={data?.volumeChange24h ?? null}
      />
      <KpiPill
        icon={<TrendingUp size={12} />}
        label="BTC Dom"
        value={data ? `${data.btcDominance.toFixed(1)}%` : "—"}
        change={data?.dominanceChange24h ?? null}
      />
      <KpiPill
        icon={<Globe size={12} />}
        label="Chains"
        value={data ? `${data.chainsTracked}` : "—"}
        change={null}
        live
      />
    </div>
  );
}

function KpiPill({
  icon,
  label,
  value,
  change,
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: number | null;
  live?: boolean;
}) {
  const up = change !== null && change >= 0;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-800/50 flex-shrink-0">
      <span className="text-slate-500">{icon}</span>
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
      {change !== null && (
        <span className={`text-xs flex items-center gap-0.5 ${up ? "text-green-500" : "text-red-500"}`}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(change).toFixed(2)}%
        </span>
      )}
      {live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
    </div>
  );
}

export default CompactKpiBar;
