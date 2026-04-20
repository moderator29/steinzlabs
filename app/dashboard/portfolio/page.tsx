"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { createChart, type IChartApi, type ISeriesApi, ColorType } from "lightweight-charts";
import { BackButton } from "@/components/ui/BackButton";
import { TokenLogo } from "@/components/market/TokenLogo";
import { PriceChangeDisplay } from "@/components/market/PriceChangeDisplay";
import { formatPrice, formatLargeNumber, formatPercent } from "@/lib/market/formatters";
import { useAuth } from "@/lib/hooks/useAuth";

type Timeframe = "1D" | "7D" | "30D" | "90D" | "ALL";
type TabId = "holdings" | "performance" | "alpha";

interface Holding {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress: string | null;
  logoUrl?: string;
  chain?: string;
  securityScore?: number;
  change24h?: number;
  costBasisUsd?: number | null;
}

interface IntelResponse {
  chain?: string;
  address?: string;
  totalBalanceUsd?: string | null;
  holdings?: Array<{
    symbol: string;
    name: string;
    balance: string;
    valueUsd: string | null;
    contractAddress: string | null;
    logoUrl?: string;
    change24h?: number;
  }>;
}

interface PerformancePoint {
  time: number;
  value: number;
}

interface PerformanceStats {
  winRate: number | null;
  totalTrades: number;
  closedTrades: number;
  bestToken: { symbol: string; pnl: number } | null;
  worstToken: { symbol: string; pnl: number } | null;
  avgHoldHours: number | null;
  totalGasUsd: number;
}

interface PerformanceResponse {
  series: PerformancePoint[];
  realized: { totalUsd: number; bySymbol: Record<string, number> };
  stats: PerformanceStats;
}

const DONUT_COLORS = ["#0A1EFF", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#8B5CF6", "#EC4899"];

function chainFor(symbol: string | undefined): string {
  const s = (symbol ?? "").toUpperCase();
  if (s === "SOL") return "solana";
  if (s === "BNB") return "bsc";
  if (s === "AVAX") return "avalanche";
  if (s === "MATIC") return "polygon";
  return "ethereum";
}

export default function PortfolioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("holdings");
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
  const [intel, setIntel] = useState<IntelResponse | null>(null);
  const [perf, setPerf] = useState<PerformanceResponse | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAddress(localStorage.getItem("wallet_address"));
    }
  }, []);

  // Fetch wallet intelligence (holdings).
  useEffect(() => {
    if (!address) return;
    let abort = false;
    setLoadingIntel(true);
    setIntelError(null);
    fetch(`/api/wallet-intelligence?address=${address}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return (await r.json()) as IntelResponse;
      })
      .then((d) => {
        if (!abort) setIntel(d);
      })
      .catch((e) => {
        if (!abort) setIntelError(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (!abort) setLoadingIntel(false);
      });
    return () => {
      abort = true;
    };
  }, [address]);

  // Fetch performance series + stats + realized PnL.
  useEffect(() => {
    if (!user) return;
    let abort = false;
    setLoadingPerf(true);
    fetch(`/api/portfolio/performance`)
      .then(async (r) => (r.ok ? ((await r.json()) as PerformanceResponse) : null))
      .then((d) => {
        if (!abort && d) setPerf(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!abort) setLoadingPerf(false);
      });
    return () => {
      abort = true;
    };
  }, [user]);

  // Live CoinGecko prices keyed by contractAddress.toLowerCase() or SYMBOL (for natives).
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; change24h: number }>>({});

  useEffect(() => {
    const raw = intel?.holdings ?? [];
    if (raw.length === 0) return;
    let abort = false;
    const payload = raw.map((h) => ({
      address: h.contractAddress,
      chain: intel?.chain,
      symbol: h.symbol,
    }));
    fetch('/api/portfolio/live-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: payload }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as { prices: Record<string, { price: number; change24h: number }> }) : null))
      .then((d) => {
        if (!abort && d) setLivePrices(d.prices ?? {});
      })
      .catch(() => {});
    return () => {
      abort = true;
    };
  }, [intel]);

  const holdings: Holding[] = useMemo(
    () =>
      (intel?.holdings ?? []).map((h) => {
        const key = h.contractAddress?.toLowerCase() || h.symbol.toUpperCase();
        const live = livePrices[key];
        const balNum = Number(h.balance) || 0;
        const liveValue = live && live.price > 0 && balNum > 0 ? balNum * live.price : null;
        return {
          ...h,
          chain: intel?.chain,
          valueUsd: liveValue != null ? String(liveValue) : h.valueUsd,
          change24h: live?.change24h ?? h.change24h,
        };
      }),
    [intel, livePrices],
  );

  const totalValueUsd = useMemo(() => {
    const live = holdings.reduce((sum, h) => sum + (Number(h.valueUsd ?? 0) || 0), 0);
    if (live > 0) return live;
    return Number(intel?.totalBalanceUsd ?? 0) || 0;
  }, [holdings, intel]);

  const tradeableHoldings = useMemo(
    () => holdings.filter((h) => (Number(h.valueUsd ?? 0) || 0) > 0),
    [holdings],
  );

  const donutData = useMemo(() => {
    const totals = tradeableHoldings
      .map((h) => ({ name: h.symbol, value: Number(h.valueUsd ?? 0) || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = totals.slice(0, 7);
    const rest = totals.slice(7).reduce((a, b) => a + b.value, 0);
    if (rest > 0) top.push({ name: "Other", value: rest });
    return top;
  }, [tradeableHoldings]);

  const riskyHoldings = useMemo(
    () => holdings.filter((h) => typeof h.securityScore === "number" && h.securityScore < 50),
    [holdings],
  );

  // Today's P&L: last point vs today's start on the cumulative series —
  // note this is capital deployed, not live mark-to-market. Shown as
  // "Today's Flow" not to mislead. All-time realized P&L is authoritative.
  const today = useMemo(() => {
    if (!perf || perf.series.length === 0) return { delta: 0, pct: null as number | null };
    const now = perf.series[perf.series.length - 1]?.value ?? 0;
    const todayStart = Math.floor(Date.now() / 86_400_000) * 86_400;
    const before = [...perf.series].reverse().find((p) => p.time < todayStart)?.value ?? now;
    const delta = now - before;
    const pct = before !== 0 ? (delta / Math.abs(before)) * 100 : null;
    return { delta, pct };
  }, [perf]);

  const realizedTotal = perf?.realized.totalUsd ?? 0;

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BackButton href="/dashboard" />
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-slate-400">
            {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect a wallet to track your holdings"}
          </p>
        </div>
      </div>

      {/* HERO */}
      <div className="rounded-2xl border border-slate-800/50 bg-slate-950/80 backdrop-blur-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Total Portfolio Value
        </div>
        <div className="flex flex-wrap items-baseline gap-4">
          <div className="text-4xl sm:text-[56px] font-mono font-bold text-white tabular-nums leading-none">
            {loadingIntel && !intel ? "—" : formatPrice(totalValueUsd)}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                today.delta >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
              }`}
            >
              {today.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {today.delta >= 0 ? "+" : ""}
              {formatPrice(today.delta)}
              {today.pct != null ? ` (${formatPercent(today.pct)})` : ""}
            </span>
            <span className="text-[11px] text-slate-500">today</span>
          </div>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          All-time realized P&L:{" "}
          <span className={`font-semibold ${realizedTotal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {realizedTotal >= 0 ? "+" : ""}
            {formatPrice(realizedTotal)}
          </span>
        </div>

        <PerformanceChart series={perf?.series ?? []} timeframe={timeframe} loading={loadingPerf} />

        <div className="mt-3 flex gap-2">
          {(["1D", "7D", "30D", "90D", "ALL"] as Timeframe[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                timeframe === t
                  ? "bg-[#0A1EFF] text-white"
                  : "bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!address && !loadingIntel && (
        <div className="rounded-xl border border-slate-800/50 bg-slate-950/60 p-8 text-center text-slate-400">
          Portfolio tracking begins with your first trade. Connect a wallet to get started.
        </div>
      )}

      {intelError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-300">
          Failed to load holdings: {intelError}
        </div>
      )}

      {/* ALLOCATION + RISKY */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/50 bg-slate-950/80 backdrop-blur-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Asset Allocation</h2>
            <span className="text-[11px] text-slate-500">{donutData.length} tokens</span>
          </div>
          {donutData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No holdings to show.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="#0A0E1A"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0A0E1A",
                      border: "1px solid rgba(148,163,184,0.2)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, n: string) => [formatPrice(v), n]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: "#94A3B8" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800/50 bg-slate-950/80 backdrop-blur-xl p-5">
          {riskyHoldings.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert size={16} className="text-rose-400" />
                <h2 className="text-sm font-semibold text-rose-300">Risky holdings</h2>
              </div>
              <ul className="space-y-2">
                {riskyHoldings.map((h) => (
                  <li
                    key={h.contractAddress ?? h.symbol}
                    className="flex items-center justify-between text-xs rounded-lg bg-rose-500/5 border border-rose-500/20 px-3 py-2"
                  >
                    <span className="font-semibold text-rose-200">{h.symbol}</span>
                    <span className="text-rose-300">Score {h.securityScore}/100</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-white mb-2">Holdings health</h2>
              <p className="text-xs text-slate-400">
                No flagged tokens in your wallet. Security scores surface here when any holding drops below 50.
              </p>
            </>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="rounded-2xl border border-slate-800/50 bg-slate-950/80 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center border-b border-slate-800/50">
          {(
            [
              ["holdings", "Holdings"],
              ["performance", "Performance"],
              ["alpha", "Alpha Intelligence"],
            ] as Array<[TabId, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-3 text-sm transition-colors ${
                tab === id
                  ? "text-[#0A1EFF] border-b-2 border-[#0A1EFF] bg-[#0A1EFF]/5"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "holdings" && (
          <HoldingsTable holdings={tradeableHoldings} loading={loadingIntel} onSelect={router.push} />
        )}
        {tab === "performance" && <PerformanceTab stats={perf?.stats ?? null} loading={loadingPerf} />}
        {tab === "alpha" && (
          <div className="p-8 text-center text-sm text-slate-400">
            Wallet DNA available after Phase 9.
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceChart({
  series,
  timeframe,
  loading,
}: {
  series: PerformancePoint[];
  timeframe: Timeframe;
  loading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const filtered = useMemo(() => {
    if (series.length === 0) return series;
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = (() => {
      switch (timeframe) {
        case "1D":
          return nowSec - 86_400;
        case "7D":
          return nowSec - 86_400 * 7;
        case "30D":
          return nowSec - 86_400 * 30;
        case "90D":
          return nowSec - 86_400 * 90;
        default:
          return 0;
      }
    })();
    return series.filter((p) => p.time >= cutoff);
  }, [series, timeframe]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94A3B8",
        fontSize: 11,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(148,163,184,0.08)" } },
      timeScale: { borderColor: "rgba(148,163,184,0.12)", timeVisible: true },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.12)" },
      width: containerRef.current.clientWidth,
      height: 180,
      autoSize: true,
    });
    const areaSeries = chart.addAreaSeries({
      lineColor: "#00BFFF",
      topColor: "rgba(0,191,255,0.30)",
      bottomColor: "rgba(0,191,255,0.02)",
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = areaSeries;
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width });
      }
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = filtered.map((p) => ({ time: p.time as never, value: p.value }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [filtered]);

  return (
    <div className="mt-4">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 180 }}
        aria-label="Portfolio performance chart"
      />
      {filtered.length === 0 && !loading && (
        <p className="text-[11px] text-slate-500 text-center mt-2">
          No trade history yet. Your portfolio chart appears after your first swap.
        </p>
      )}
    </div>
  );
}

function HoldingsTable({
  holdings,
  loading,
  onSelect,
}: {
  holdings: Holding[];
  loading: boolean;
  onSelect: (path: string) => void;
}) {
  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading holdings…</div>;
  }
  if (holdings.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        Portfolio tracking begins with your first trade.
      </div>
    );
  }

  const goTo = (h: Holding) => {
    const chain = h.chain ?? chainFor(h.symbol);
    const addr = h.contractAddress ?? h.symbol.toLowerCase();
    onSelect(`/dashboard/market/${chain}/${addr}`);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800/60">
            <th className="px-4 py-3 text-left">Token</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="px-4 py-3 text-right">Current Price</th>
            <th className="px-4 py-3 text-right">24h</th>
            <th className="px-4 py-3 text-right">Value</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const valueUsd = Number(h.valueUsd ?? 0) || 0;
            const balNum = Number(h.balance) || 0;
            const currentPrice = balNum > 0 ? valueUsd / balNum : 0;
            return (
              <tr
                key={h.contractAddress ?? h.symbol}
                className="border-b border-slate-900/60 hover:bg-slate-900/40 transition-colors cursor-pointer"
                onClick={() => goTo(h)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <TokenLogo src={h.logoUrl} symbol={h.symbol} size={28} />
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{h.symbol}</div>
                      <div className="text-xs text-slate-500 truncate">{h.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                  {balNum < 0.0001 ? balNum.toExponential(2) : balNum.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </td>
                <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                  {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {typeof h.change24h === "number" ? <PriceChangeDisplay value={h.change24h} size="sm" /> : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                  {valueUsd > 0 ? formatLargeNumber(valueUsd) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goTo(h);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#0A1EFF]/15 text-[#6F7EFF] hover:bg-[#0A1EFF]/25 transition-colors"
                    >
                      Trade <ArrowRight size={10} className="inline ml-0.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PerformanceTab({ stats, loading }: { stats: PerformanceStats | null; loading: boolean }) {
  if (loading && !stats) {
    return <div className="p-6 text-sm text-slate-500">Computing performance…</div>;
  }
  if (!stats) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        Performance metrics appear after your first closed round-trip trade.
      </div>
    );
  }
  return (
    <div className="p-5 grid gap-3 grid-cols-2 md:grid-cols-3">
      <Metric label="Win rate" value={stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : "—"} />
      <Metric label="Closed trades" value={stats.closedTrades.toString()} />
      <Metric label="Total trades" value={stats.totalTrades.toString()} />
      <Metric
        label="Avg hold"
        value={
          stats.avgHoldHours != null
            ? stats.avgHoldHours >= 24
              ? `${(stats.avgHoldHours / 24).toFixed(1)}d`
              : `${stats.avgHoldHours.toFixed(1)}h`
            : "—"
        }
      />
      <Metric
        label="Best token"
        value={stats.bestToken ? `${stats.bestToken.symbol} · ${formatPrice(stats.bestToken.pnl)}` : "—"}
      />
      <Metric
        label="Worst token"
        value={stats.worstToken ? `${stats.worstToken.symbol} · ${formatPrice(stats.worstToken.pnl)}` : "—"}
      />
      <Metric label="Total gas" value={formatPrice(stats.totalGasUsd)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-white mt-1 truncate">{value}</div>
    </div>
  );
}
