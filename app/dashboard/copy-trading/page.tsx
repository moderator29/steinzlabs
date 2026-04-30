"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pause, Play, Plus, Power, Shield, Trash2 } from "lucide-react";
import { SecurityBadge } from "@/components/security/SecurityBadge";
import { toast } from "sonner";
import NewCopyRuleModal from "./NewCopyRuleModal";

type CopyMode = "alerts_only" | "oneclick" | "auto_copy";

interface CopyRule {
  id: string;
  whale_address: string;
  chain: string;
  mode: CopyMode | null;
  max_per_trade_usd: number;
  daily_cap_usd: number;
  pct_of_whale: number | null;
  tp_pct: number | null;
  sl_pct: number | null;
  min_liquidity_usd: number;
  max_slippage_bps: number;
  enabled: boolean;
  paused: boolean;
}

interface CopyTrade {
  id: string;
  source_whale: string;
  chain: string | null;
  token_symbol: string | null;
  action: "buy" | "sell";
  amount_usd: number | null;
  status: string;
  failure_reason: string | null;
  security_score: number | null;
  pnl_usd: number | null;
  created_at: string;
}

interface Stats {
  total: number;
  executed: number;
  blocked: number;
  totalInvested: number;
  totalPnl: number;
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function CopyTradingPage() {
  const [rules, setRules] = useState<CopyRule[]>([]);
  const [trades, setTrades] = useState<CopyTrade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"rules" | "trades">("rules");
  const [showNewRule, setShowNewRule] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([
        fetch("/api/copy-trading/rules").then((r) => r.json()),
        fetch("/api/copy-trading/trades").then((r) => r.json()),
      ]);
      setRules(r.rules ?? []);
      setTrades(t.trades ?? []);
      setStats(t.stats ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleEnabled(rule: CopyRule) {
    const res = await fetch(`/api/copy-trading/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (res.ok) load();
    else toast.error("Failed");
  }

  async function togglePaused(rule: CopyRule) {
    const res = await fetch(`/api/copy-trading/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !rule.paused }),
    });
    if (res.ok) {
      toast.success(rule.paused ? "Resumed" : "Paused");
      load();
    } else {
      toast.error("Failed");
    }
  }

  async function deleteRule(rule: CopyRule) {
    const res = await fetch(`/api/copy-trading/rules/${rule.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Rule removed");
      load();
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Copy Trading</h1>
            <p className="text-xs text-slate-500 mt-1">
              Three modes: Alerts, One-Click, Auto-Copy. Every trade passes GoPlus + your rules before the relayer touches it.
            </p>
          </div>
          <button
            onClick={() => setShowNewRule(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white"
          >
            <Plus size={13} /> New rule
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Rules" value={rules.filter((r) => r.enabled).length.toString()} sub={`${rules.length} total`} />
            <StatCard label="Copied trades" value={stats.executed.toString()} sub={`${stats.total} attempts`} />
            <StatCard label="Blocked" value={stats.blocked.toString()} sub="security + rule guards" tone="warn" />
            <StatCard
              label="Net PnL"
              value={fmtUsd(stats.totalPnl)}
              sub={`on ${fmtUsd(stats.totalInvested)} invested`}
              tone={stats.totalPnl >= 0 ? "up" : "down"}
            />
          </div>
        )}

        <div className="flex gap-1 border-b border-slate-800 mb-4">
          {(["rules", "trades"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs uppercase tracking-wide transition ${
                tab === t ? "text-blue-300 border-b-2 border-blue-500/60" : "text-slate-500 hover:text-white"
              }`}
            >
              {t === "rules" ? "Rules" : "Trades"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-blue-400" />
          </div>
        ) : tab === "rules" ? (
          rules.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No copy rules yet. Open a whale from the{" "}
              <Link href="/dashboard/whale-tracker" className="text-blue-400">
                whale tracker
              </Link>{" "}
              and add one.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <code className="text-xs font-mono text-white truncate">{r.whale_address.slice(0, 8)}…{r.whale_address.slice(-4)}</code>
                      <span className="text-[10px] uppercase text-slate-500">{r.chain}</span>
                      <ModeBadge mode={r.mode ?? "oneclick"} />
                      {r.paused && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">paused</span>
                      )}
                      {!r.enabled && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400">off</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      {r.pct_of_whale != null ? (
                        <span>{r.pct_of_whale}% of whale (cap {fmtUsd(r.max_per_trade_usd)})</span>
                      ) : (
                        <span>Max/trade {fmtUsd(r.max_per_trade_usd)}</span>
                      )}
                      <span>Daily {fmtUsd(r.daily_cap_usd)}</span>
                      {r.tp_pct != null && <span className="text-green-400/70">TP +{r.tp_pct}%</span>}
                      {r.sl_pct != null && <span className="text-red-400/70">SL −{r.sl_pct}%</span>}
                      <span>Slip {(r.max_slippage_bps / 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePaused(r)}
                    title={r.paused ? "Resume" : "Pause"}
                    className={`p-1.5 rounded transition ${r.paused ? "text-amber-400 hover:bg-amber-500/10" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    {r.paused ? <Play size={13} /> : <Pause size={13} />}
                  </button>
                  <button
                    onClick={() => toggleEnabled(r)}
                    title={r.enabled ? "Disable" : "Enable"}
                    className={`p-1.5 rounded transition ${r.enabled ? "text-green-400 hover:bg-green-500/10" : "text-slate-500 hover:bg-white/5"}`}
                  >
                    <Power size={13} />
                  </button>
                  <button onClick={() => deleteRule(r)} className="p-1.5 rounded text-slate-500 hover:text-red-400 transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : trades.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No copy trades yet</div>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Whale</th>
                  <th className="text-left px-3 py-2">Token</th>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Security</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-slate-500">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{t.source_whale.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono text-white">{t.token_symbol ?? "?"}</td>
                    <td className={`px-3 py-2 uppercase text-[10px] ${t.action === "buy" ? "text-green-400" : "text-red-400"}`}>{t.action}</td>
                    <td className="px-3 py-2 font-mono">{t.amount_usd ? fmtUsd(t.amount_usd) : "—"}</td>
                    <td className="px-3 py-2">
                      {t.security_score !== null ? <SecurityBadge score={t.security_score} size="sm" compact /> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-[10px] uppercase ${
                      t.status === "success" ? "text-green-400" :
                      t.status === "pending" ? "text-amber-400" :
                      t.status === "alert" ? "text-blue-400" :
                      t.status === "failed" || t.status === "cancelled" ? "text-red-400" : "text-slate-500"
                    }`}>
                      {t.status}
                    </td>
                    <td className="px-3 py-2 text-slate-500 truncate max-w-[140px]">{t.failure_reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
          <Shield size={14} className="text-blue-300 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-200/80 leading-relaxed">
            <p className="font-semibold text-blue-200 mb-1">Non-custodial by design.</p>
            One-Click and Auto-Copy still need your browser to sign — Naka Labs never holds keys. Auto-Copy users opt into auto-confirmation while the dashboard is open.
          </div>
        </div>
      </div>

      {showNewRule && (
        <NewCopyRuleModal onClose={() => setShowNewRule(false)} onSaved={load} />
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: CopyMode }) {
  const map: Record<CopyMode, { label: string; cls: string }> = {
    alerts_only: { label: "Alerts", cls: "bg-slate-500/15 text-slate-300" },
    oneclick: { label: "One-Click", cls: "bg-blue-500/15 text-blue-300" },
    auto_copy: { label: "Auto", cls: "bg-purple-500/15 text-purple-300" },
  };
  const m = map[mode];
  return <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" | "warn" }) {
  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-3">
      <p className="text-[9px] uppercase text-slate-500 tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-mono ${
        tone === "up" ? "text-green-400" : tone === "down" ? "text-red-400" : tone === "warn" ? "text-amber-400" : "text-white"
      }`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}
