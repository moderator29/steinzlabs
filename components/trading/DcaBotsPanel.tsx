"use client";

import { useEffect, useState } from "react";
import { Spinner, Empty } from "./OpenOrdersPanel";
import { Play, Pause, X } from "lucide-react";
import { toast } from "sonner";

interface DcaBot {
  id: string;
  from_token_symbol: string | null;
  to_token_symbol: string | null;
  amount_per_execution: number;
  interval_seconds: number;
  executions_completed: number;
  total_executions: number | null;
  total_invested_usd: number;
  avg_entry_price: number | null;
  status: string;
  next_execution_at: string;
}

function interval(sec: number): string {
  if (sec < 3600) return `${sec}s`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

export function DcaBotsPanel() {
  const [bots, setBots] = useState<DcaBot[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/trading/dca-bots", { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as { bots: DcaBot[] };
      setBots(json.bots ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/trading/dca-bots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (res.ok) load();
    else toast.error("Update failed");
  }

  async function cancel(id: string) {
    const res = await fetch(`/api/trading/dca-bots/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast.success("Bot cancelled");
      load();
    }
  }

  if (loading) return <Spinner />;
  if (bots.length === 0) return <Empty text="No DCA bots" />;

  return (
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
        <tr>
          <th className="text-left px-3 py-2">Pair</th>
          <th className="text-left px-3 py-2">Amount</th>
          <th className="text-left px-3 py-2">Interval</th>
          <th className="text-left px-3 py-2">Runs</th>
          <th className="text-left px-3 py-2">Invested</th>
          <th className="text-left px-3 py-2">Avg entry</th>
          <th className="text-left px-3 py-2">Next</th>
          <th className="text-left px-3 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {bots.map((b) => (
          <tr key={b.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
            <td className="px-3 py-2 text-slate-300">{b.from_token_symbol} → {b.to_token_symbol}</td>
            <td className="px-3 py-2 font-mono text-slate-300">${b.amount_per_execution}</td>
            <td className="px-3 py-2 font-mono text-slate-300">{interval(b.interval_seconds)}</td>
            <td className="px-3 py-2 font-mono text-slate-300">
              {b.executions_completed}{b.total_executions ? `/${b.total_executions}` : ""}
            </td>
            <td className="px-3 py-2 font-mono text-slate-300">${b.total_invested_usd.toFixed(0)}</td>
            <td className="px-3 py-2 font-mono text-slate-400">{b.avg_entry_price ? `$${b.avg_entry_price}` : "—"}</td>
            <td className="px-3 py-2 text-slate-400">{new Date(b.next_execution_at).toLocaleDateString()}</td>
            <td className="px-3 py-2 flex gap-1">
              {b.status === "active" ? (
                <button onClick={() => patch(b.id, { status: "paused" })} className="text-slate-500 hover:text-amber-400" aria-label="Pause">
                  <Pause size={12} />
                </button>
              ) : (
                <button onClick={() => patch(b.id, { status: "active" })} className="text-slate-500 hover:text-green-400" aria-label="Resume">
                  <Play size={12} />
                </button>
              )}
              <button onClick={() => cancel(b.id)} className="text-slate-500 hover:text-red-400" aria-label="Cancel">
                <X size={12} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
