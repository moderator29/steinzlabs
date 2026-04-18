"use client";

import Link from "next/link";
import { SecurityBadge } from "@/components/security/SecurityBadge";
import { CheckCircle2, ExternalLink } from "lucide-react";

export interface WhaleSummary {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  entity_type: string | null;
  portfolio_value_usd: number | null;
  pnl_30d_usd: number | null;
  win_rate: number | null;
  whale_score: number;
  follower_count: number;
  x_handle: string | null;
  verified: boolean;
  last_active_at: string | null;
}

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function shortAddr(a: string): string {
  if (!a) return "";
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function WhaleCard({ whale }: { whale: WhaleSummary }) {
  const up = (whale.pnl_30d_usd ?? 0) >= 0;
  return (
    <Link
      href={`/dashboard/whale-tracker/${whale.address}?chain=${whale.chain}`}
      className="block p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/40 transition group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="text-sm font-semibold text-white truncate">{whale.label ?? shortAddr(whale.address)}</h3>
            {whale.verified && <CheckCircle2 size={12} className="text-blue-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5">
            <code className="text-[10px] text-slate-500 font-mono">{shortAddr(whale.address)}</code>
            <span className="text-[9px] uppercase text-slate-600">{whale.chain}</span>
          </div>
        </div>
        <SecurityBadge score={whale.whale_score} size="sm" compact />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Portfolio" value={fmtUsd(whale.portfolio_value_usd)} />
        <Stat
          label="30d PnL"
          value={whale.pnl_30d_usd !== null ? `${up ? "+" : ""}${fmtUsd(whale.pnl_30d_usd)}` : "—"}
          tone={up ? "up" : "down"}
        />
        <Stat
          label="Win rate"
          value={whale.win_rate !== null ? `${(whale.win_rate * 100).toFixed(0)}%` : "—"}
        />
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/50">
        <span className="text-[10px] uppercase text-slate-500 tracking-wide">
          {whale.entity_type ?? "unknown"} · {whale.follower_count} followers
        </span>
        <ExternalLink size={11} className="text-slate-600 group-hover:text-blue-400 transition" />
      </div>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <p className="text-[9px] uppercase text-slate-500 tracking-wide mb-0.5">{label}</p>
      <p className={`font-mono text-xs ${tone === "up" ? "text-green-400" : tone === "down" ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
