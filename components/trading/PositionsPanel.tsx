"use client";

import { useEffect, useState } from "react";
import { Spinner, Empty } from "./OpenOrdersPanel";

interface Position {
  token_address: string;
  token_symbol: string;
  chain: string;
  amount: number;
  avg_entry_usd: number | null;
  current_price_usd: number | null;
  pnl_usd: number | null;
  pnl_pct: number | null;
}

export function PositionsPanel() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trading/positions", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { positions: Position[] };
        if (!cancelled) setPositions(json.positions ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner />;
  if (positions.length === 0) return <Empty text="No open positions" />;

  return (
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
        <tr>
          <th className="text-left px-3 py-2">Token</th>
          <th className="text-left px-3 py-2">Chain</th>
          <th className="text-left px-3 py-2">Amount</th>
          <th className="text-left px-3 py-2">Avg entry</th>
          <th className="text-left px-3 py-2">Price</th>
          <th className="text-left px-3 py-2">PnL</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const up = (p.pnl_usd ?? 0) >= 0;
          return (
            <tr key={`${p.chain}:${p.token_address}`} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
              <td className="px-3 py-2 text-white font-semibold">{p.token_symbol}</td>
              <td className="px-3 py-2 text-[10px] uppercase text-slate-500">{p.chain}</td>
              <td className="px-3 py-2 font-mono text-slate-300">{p.amount}</td>
              <td className="px-3 py-2 font-mono text-slate-400">{p.avg_entry_usd !== null ? `$${p.avg_entry_usd}` : "—"}</td>
              <td className="px-3 py-2 font-mono text-slate-300">{p.current_price_usd !== null ? `$${p.current_price_usd}` : "—"}</td>
              <td className={`px-3 py-2 font-mono ${up ? "text-green-400" : "text-red-400"}`}>
                {p.pnl_pct !== null ? `${up ? "+" : ""}${p.pnl_pct.toFixed(2)}%` : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
