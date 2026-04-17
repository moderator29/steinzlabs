"use client";

import { useEffect, useState } from "react";
import { Spinner, Empty } from "./OpenOrdersPanel";
import { X } from "lucide-react";
import { toast } from "sonner";

interface SlOrder {
  id: string;
  token_symbol: string | null;
  chain: string;
  position_amount: number;
  entry_price_usd: number | null;
  stop_loss_price_usd: number | null;
  take_profit_price_usd: number | null;
  trailing_stop_percent: number | null;
  highest_price_seen: number | null;
  status: string;
}

export function StopLossPanel() {
  const [orders, setOrders] = useState<SlOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/trading/stop-loss", { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as { orders: SlOrder[] };
      setOrders(json.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id: string) {
    const res = await fetch(`/api/trading/stop-loss/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast.success("Cancelled");
      load();
    }
  }

  if (loading) return <Spinner />;
  if (orders.length === 0) return <Empty text="No active stop/TP orders" />;

  return (
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
        <tr>
          <th className="text-left px-3 py-2">Token</th>
          <th className="text-left px-3 py-2">Amount</th>
          <th className="text-left px-3 py-2">Entry</th>
          <th className="text-left px-3 py-2">Stop loss</th>
          <th className="text-left px-3 py-2">Take profit</th>
          <th className="text-left px-3 py-2">Trail %</th>
          <th className="text-left px-3 py-2">Status</th>
          <th className="text-left px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
            <td className="px-3 py-2 text-white font-semibold">{o.token_symbol}</td>
            <td className="px-3 py-2 font-mono text-slate-300">{o.position_amount}</td>
            <td className="px-3 py-2 font-mono text-slate-400">{o.entry_price_usd ? `$${o.entry_price_usd}` : "—"}</td>
            <td className="px-3 py-2 font-mono text-red-400">{o.stop_loss_price_usd ? `$${o.stop_loss_price_usd}` : "—"}</td>
            <td className="px-3 py-2 font-mono text-green-400">{o.take_profit_price_usd ? `$${o.take_profit_price_usd}` : "—"}</td>
            <td className="px-3 py-2 font-mono text-slate-300">{o.trailing_stop_percent ? `${o.trailing_stop_percent}%` : "—"}</td>
            <td className="px-3 py-2 text-[10px] uppercase text-slate-400">{o.status}</td>
            <td className="px-3 py-2">
              <button onClick={() => cancel(o.id)} className="text-slate-500 hover:text-red-400" aria-label="Cancel">
                <X size={12} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
