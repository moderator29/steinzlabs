"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, BellPlus } from "lucide-react";
import { AlphaReportCard, type AlphaReportView } from "./AlphaReportCard";
import { SecurityBadge } from "@/components/security/SecurityBadge";
import { toast } from "sonner";

type Tab = "overview" | "holdings" | "activity" | "counterparties" | "performance" | "clusters";

interface WhaleDetail {
  address: string;
  chain: string;
  label: string | null;
  entity_type: string | null;
  portfolio_value_usd: number | null;
  pnl_30d_usd: number | null;
  pnl_90d_usd: number | null;
  win_rate: number | null;
  trade_count_30d: number | null;
  whale_score: number;
  follower_count: number;
  verified: boolean;
}

interface ActivityRow {
  id: string;
  action: string;
  token_symbol: string | null;
  amount: number | null;
  value_usd: number | null;
  counterparty_label: string | null;
  counterparty: string | null;
  timestamp: string;
}

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function WalletIntelligenceTabs({ address }: { address: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [whale, setWhale] = useState<WhaleDetail | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [report, setReport] = useState<AlphaReportView | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/whales/${address}`);
        if (res.ok) {
          const json = (await res.json()) as { whale: WhaleDetail; activity: ActivityRow[] };
          if (!cancelled) {
            setWhale(json.whale);
            setActivity(json.activity);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function generateReport() {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/wallet-intelligence/${address}/alpha-report`);
      const json = await res.json();
      if (res.ok) setReport(json.report);
      else toast.error("Failed to generate report");
    } finally {
      setReportLoading(false);
    }
  }

  async function createAlert() {
    if (!whale) return;
    const res = await fetch("/api/wallet-intelligence/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_address: address, chain: whale.chain, min_trade_usd: 10000 }),
    });
    if (res.ok) toast.success("Alert created");
    else toast.error("Alert failed");
  }

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-blue-400" />
      </div>
    );
  }
  if (!whale) {
    return <p className="text-sm text-slate-500 text-center py-12">Wallet not tracked. Submit it via the whale tracker.</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold">{whale.label ?? address.slice(0, 10) + "…"}</h2>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{address}</p>
        </div>
        <div className="flex items-center gap-2">
          <SecurityBadge score={whale.whale_score} size="md" />
          <button
            onClick={createAlert}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/30 text-[11px] text-slate-300 transition"
          >
            <BellPlus size={11} /> Alert
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-800 -mb-px overflow-x-auto mb-5">
        {(["overview", "holdings", "activity", "counterparties", "performance", "clusters"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs uppercase tracking-wide whitespace-nowrap transition ${
              tab === t ? "text-blue-300 border-b-2 border-blue-500/60" : "text-slate-500 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Portfolio" value={fmtUsd(whale.portfolio_value_usd)} />
            <Stat label="30d PnL" value={fmtUsd(whale.pnl_30d_usd)} tone={(whale.pnl_30d_usd ?? 0) >= 0 ? "up" : "down"} />
            <Stat label="Win rate" value={whale.win_rate !== null ? `${(whale.win_rate * 100).toFixed(0)}%` : "—"} />
            <Stat label="Score" value={whale.whale_score.toString()} />
          </div>
          {report ? (
            <AlphaReportCard report={report} />
          ) : (
            <button
              onClick={generateReport}
              disabled={reportLoading}
              className="w-full p-5 rounded-2xl border border-dashed border-blue-500/30 bg-blue-500/5 text-sm text-blue-300 hover:bg-blue-500/10 transition flex items-center justify-center gap-2"
            >
              {reportLoading ? <Loader2 size={13} className="animate-spin" /> : null}
              Generate Alpha Intelligence Report via VTX
            </button>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          {activity.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No recorded activity yet. The whale-activity-poll cron populates this as new on-chain events arrive.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
                <tr>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Token</th>
                  <th className="text-left px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">USD</th>
                  <th className="text-left px-3 py-2">Counterparty</th>
                  <th className="text-left px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 uppercase text-[10px] text-slate-400">{a.action}</td>
                    <td className="px-3 py-2 font-mono text-white">{a.token_symbol ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{a.amount ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{fmtUsd(a.value_usd)}</td>
                    <td className="px-3 py-2 text-slate-400 truncate max-w-[140px]">{a.counterparty_label ?? a.counterparty ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(a.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "holdings" && (
        <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-800">
          Token holdings surface once the on-chain indexer ships in Session 5B-2.
        </div>
      )}

      {tab === "counterparties" && (
        <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-800">
          Counterparty analysis uses wallet_edges data.{" "}
          <Link href={`/dashboard/wallet-clusters/${address}`} className="text-blue-400 hover:underline">
            Explore cluster →
          </Link>
        </div>
      )}

      {tab === "performance" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="7d PnL" value="—" />
          <Stat label="30d PnL" value={fmtUsd(whale.pnl_30d_usd)} tone={(whale.pnl_30d_usd ?? 0) >= 0 ? "up" : "down"} />
          <Stat label="90d PnL" value={fmtUsd(whale.pnl_90d_usd)} tone={(whale.pnl_90d_usd ?? 0) >= 0 ? "up" : "down"} />
          <Stat label="Trades (30d)" value={whale.trade_count_30d?.toString() ?? "—"} />
          <Stat label="Win rate" value={whale.win_rate !== null ? `${(whale.win_rate * 100).toFixed(0)}%` : "—"} />
          <Stat label="Followers" value={whale.follower_count.toLocaleString()} />
        </div>
      )}

      {tab === "clusters" && (
        <div className="p-6 rounded-xl border border-slate-800 text-center">
          <p className="text-sm text-slate-400 mb-3">Explore this wallet&apos;s cluster graph.</p>
          <Link
            href={`/dashboard/wallet-clusters/${address}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition"
          >
            Open cluster explorer →
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-3">
      <p className="text-[9px] uppercase text-slate-500 tracking-wide mb-1">{label}</p>
      <p className={`text-base font-mono ${tone === "up" ? "text-green-400" : tone === "down" ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
