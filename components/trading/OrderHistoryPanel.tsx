"use client";

import { useEffect, useState } from "react";
import { Spinner, Empty } from "./OpenOrdersPanel";

interface HistoryRow {
  id: string;
  type: "limit" | "dca" | "stop";
  pair: string;
  amount: number | null;
  price: number | null;
  status: string;
  executed_at: string;
  tx_hash: string | null;
}

export function OrderHistoryPanel() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trading/order-history", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { rows: HistoryRow[] };
        if (!cancelled) setRows(json.rows ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner />;
  if (rows.length === 0) return <Empty text="No order history yet" />;

  return (
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
        <tr>
          <th className="text-left px-3 py-2">Type</th>
          <th className="text-left px-3 py-2">Pair</th>
          <th className="text-left px-3 py-2">Amount</th>
          <th className="text-left px-3 py-2">Price</th>
          <th className="text-left px-3 py-2">Status</th>
          <th className="text-left px-3 py-2">When</th>
          <th className="text-left px-3 py-2">Tx</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
            <td className="px-3 py-2 text-[10px] uppercase text-slate-400">{r.type}</td>
            <td className="px-3 py-2 text-slate-300">{r.pair}</td>
            <td className="px-3 py-2 font-mono text-slate-300">{r.amount ?? "—"}</td>
            <td className="px-3 py-2 font-mono text-slate-300">{r.price !== null ? `$${r.price}` : "—"}</td>
            <td className={`px-3 py-2 text-[10px] uppercase ${
              r.status === "executed" || r.status.startsWith("triggered") || r.status === "success"
                ? "text-green-400"
                : r.status === "failed"
                  ? "text-red-400"
                  : "text-slate-500"
            }`}>
              {r.status}
            </td>
            <td className="px-3 py-2 text-slate-400">{new Date(r.executed_at).toLocaleDateString()}</td>
            <td className="px-3 py-2">
              {r.tx_hash && (
                <code className="text-[10px] text-blue-400 truncate max-w-[100px] inline-block">
                  {r.tx_hash.slice(0, 8)}…
                </code>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
