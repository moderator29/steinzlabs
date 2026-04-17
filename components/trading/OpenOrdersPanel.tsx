"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface LimitOrder {
  id: string;
  chain: string;
  from_token_symbol: string | null;
  to_token_symbol: string | null;
  from_amount: number;
  trigger_price_usd: number;
  trigger_direction: "above" | "below";
  expires_at: string | null;
  created_at: string;
}

export function OpenOrdersPanel() {
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/trading/limit-orders?status=active", { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as { orders: LimitOrder[] };
      setOrders(json.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id: string) {
    const res = await fetch(`/api/trading/limit-orders/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast.success("Order cancelled");
      load();
    } else {
      toast.error("Cancel failed");
    }
  }

  if (loading) return <Spinner />;
  if (orders.length === 0) return <Empty text="No open limit orders" />;

  return (
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
        <tr>
          <Th>Pair</Th>
          <Th>Trigger</Th>
          <Th>Amount</Th>
          <Th>Expires</Th>
          <Th>Created</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
            <Td>{o.from_token_symbol ?? "?"} → {o.to_token_symbol ?? "?"}</Td>
            <Td className="font-mono">
              {o.trigger_direction === "above" ? "≥" : "≤"} ${o.trigger_price_usd}
            </Td>
            <Td className="font-mono">{o.from_amount}</Td>
            <Td>{o.expires_at ? new Date(o.expires_at).toLocaleDateString() : "Never"}</Td>
            <Td>{new Date(o.created_at).toLocaleDateString()}</Td>
            <Td>
              <button
                onClick={() => cancel(o.id)}
                className="text-slate-500 hover:text-red-400 transition"
                aria-label="Cancel"
              >
                <X size={12} />
              </button>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return <div className="flex items-center justify-center py-8 text-xs text-slate-500">{text}</div>;
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left px-3 py-2 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-300 ${className}`}>{children}</td>;
}
