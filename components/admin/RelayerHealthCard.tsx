"use client";

import { useCallback, useEffect, useState } from "react";

interface StatusCount {
  status: string;
  count: number;
}

interface CronStat {
  cron_name: string;
  runs_24h: number;
  failures_24h: number;
  last_run: string | null;
}

interface RecentRevert {
  table: string;
  id: string;
  revert_reason: string | null;
  at: string;
}

interface RelayerHealth {
  pending_trades: StatusCount[];
  limit_orders: StatusCount[];
  dca_bots: StatusCount[];
  stop_loss_orders: StatusCount[];
  user_copy_trades: StatusCount[];
  cron_stats: CronStat[];
  reconciliation_backlog: {
    limit_orders: number;
    dca_executions: number;
    stop_loss_orders: number;
    user_copy_trades: number;
  };
  recent_reverts: RecentRevert[];
  generated_at: string;
}

function StatusBlock({ title, data }: { title: string; data: StatusCount[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="space-y-1">
        {data.length === 0 && <div className="text-xs text-slate-500">—</div>}
        {data.map((row) => (
          <div key={row.status} className="flex items-center justify-between text-xs">
            <span className="font-mono text-slate-300">{row.status}</span>
            <span className="tabular-nums font-semibold text-white">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RelayerHealthCard() {
  const [data, setData] = useState<RelayerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/relayer-health", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      setData((await res.json()) as RelayerHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-800/60" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4">
        <div className="text-sm text-rose-300">Relayer health unavailable: {error}</div>
        <button
          type="button"
          onClick={load}
          className="mt-2 rounded-md border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const totalBacklog =
    data.reconciliation_backlog.limit_orders +
    data.reconciliation_backlog.dca_executions +
    data.reconciliation_backlog.stop_loss_orders +
    data.reconciliation_backlog.user_copy_trades;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Relayer Health</h2>
          <p className="text-xs text-slate-400">
            Live snapshot · refreshed {new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatusBlock title="Pending Trades" data={data.pending_trades} />
        <StatusBlock title="Limit Orders" data={data.limit_orders} />
        <StatusBlock title="DCA Bots" data={data.dca_bots} />
        <StatusBlock title="Stop-Loss" data={data.stop_loss_orders} />
        <StatusBlock title="Copy Trades" data={data.user_copy_trades} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cron Stats (24h)
            </span>
          </div>
          <div className="space-y-1.5">
            {data.cron_stats.map((c) => {
              const successRate =
                c.runs_24h > 0 ? ((c.runs_24h - c.failures_24h) / c.runs_24h) * 100 : null;
              const rateColor =
                successRate == null
                  ? "text-slate-500"
                  : successRate >= 99
                    ? "text-emerald-400"
                    : successRate >= 90
                      ? "text-amber-400"
                      : "text-rose-400";
              return (
                <div key={c.cron_name} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300">{c.cron_name}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-slate-500">{c.runs_24h} runs</span>
                    <span className={`tabular-nums font-semibold ${rateColor}`}>
                      {successRate == null ? "—" : `${successRate.toFixed(1)}%`}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Reconciliation Backlog
            </span>
            <span
              className={`text-xs font-semibold tabular-nums ${
                totalBacklog === 0 ? "text-emerald-400" : totalBacklog < 50 ? "text-amber-400" : "text-rose-400"
              }`}
            >
              {totalBacklog} pending
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">limit_orders</span>
              <span className="tabular-nums text-white">{data.reconciliation_backlog.limit_orders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">dca_executions</span>
              <span className="tabular-nums text-white">{data.reconciliation_backlog.dca_executions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">stop_loss_orders</span>
              <span className="tabular-nums text-white">{data.reconciliation_backlog.stop_loss_orders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">copy_trades</span>
              <span className="tabular-nums text-white">{data.reconciliation_backlog.user_copy_trades}</span>
            </div>
          </div>
        </div>
      </div>

      {data.recent_reverts.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent reverts (24h)
          </div>
          <div className="space-y-1">
            {data.recent_reverts.map((r) => (
              <div key={`${r.table}:${r.id}`} className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400">
                  {r.table}/{r.id.slice(0, 8)}
                </span>
                <span className="truncate text-rose-300 ml-3 max-w-[50%]">
                  {r.revert_reason ?? "reverted"}
                </span>
                <span className="tabular-nums text-slate-500">
                  {new Date(r.at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
