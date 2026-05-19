"use client";

import { useEffect, useState } from "react";
import { Activity, Target, TrendingDown, TrendingUp, ExternalLink } from "lucide-react";

interface MonitoredPosition {
  id: string;
  token_address: string;
  token_symbol: string | null;
  chain: string | null;
  entry_price_usd: number | null;
  peak_price_usd: number | null;
  executed_at: string;
}

interface TriggeredStop {
  id: string;
  token_address: string;
  token_symbol: string | null;
  chain: string | null;
  pnl_usd: number | null;
  sell_dispatched_at: string | null;
  sell_tx_hash: string | null;
  realized_at: string | null;
}

interface StatusPayload {
  monitoring_active_count: number;
  monitored: MonitoredPosition[];
  stops_triggered: TriggeredStop[];
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function short(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AutosellStatusCard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/sniper/autosell-status", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as StatusPayload;
        if (mounted) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (mounted) setErr(e instanceof Error ? e.message : "load failed");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
        <div className="text-xs text-slate-400">Loading autosell status…</div>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <div className="text-xs text-red-300">Couldn’t load autosell status — {err}</div>
      </div>
    );
  }

  if (!data) return null;

  const monitoring = data.monitoring_active_count;
  const triggered = data.stops_triggered;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
            Autosell monitor
          </span>
          {monitoring > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              {monitoring} active
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500">Auto-refresh 30s</span>
      </div>

      {monitoring === 0 && triggered.length === 0 && (
        <div className="text-xs text-slate-400">
          No positions being monitored. Open a position with a TP/SL set and the executor will watch it here.
        </div>
      )}

      {monitoring > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
            Monitoring ({Math.min(monitoring, 5)} of {monitoring})
          </div>
          <div className="space-y-1">
            {data.monitored.slice(0, 5).map((p) => {
              const peakOverEntry =
                p.peak_price_usd && p.entry_price_usd && p.entry_price_usd > 0
                  ? ((p.peak_price_usd - p.entry_price_usd) / p.entry_price_usd) * 100
                  : null;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/40 bg-slate-900/30 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Target className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {p.token_symbol ?? short(p.token_address)}
                    </span>
                    <span className="text-[10px] text-slate-500">{p.chain ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] tabular-nums">
                    {peakOverEntry !== null && (
                      <span className={peakOverEntry >= 0 ? "text-emerald-400" : "text-red-400"}>
                        peak {peakOverEntry >= 0 ? "+" : ""}
                        {peakOverEntry.toFixed(1)}%
                      </span>
                    )}
                    <span className="text-slate-500">{relTime(p.executed_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {triggered.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
            Stops triggered (last {triggered.length})
          </div>
          <div className="space-y-1">
            {triggered.map((t) => {
              const win = (t.pnl_usd ?? 0) >= 0;
              const Icon = win ? TrendingUp : TrendingDown;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/40 bg-slate-900/30 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${win ? "text-emerald-400" : "text-red-400"}`} />
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {t.token_symbol ?? short(t.token_address)}
                    </span>
                    <span className="text-[10px] text-slate-500">{t.chain ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] tabular-nums">
                    {t.pnl_usd !== null && (
                      <span className={win ? "text-emerald-400" : "text-red-400"}>
                        {win ? "+" : ""}${t.pnl_usd.toFixed(2)}
                      </span>
                    )}
                    <span className="text-slate-500">{relTime(t.sell_dispatched_at)}</span>
                    {t.sell_tx_hash && (
                      <a
                        href={`https://etherscan.io/tx/${t.sell_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-200"
                        aria-label="View sell transaction"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
