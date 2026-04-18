"use client";

import { useWhaleActivityStream } from "@/lib/hooks/useWhaleActivityStream";
import { Radio, WifiOff } from "lucide-react";

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function shortAddr(a: string): string {
  if (!a) return "";
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function LiveActivityFeed({ followed, minUsd = 50_000 }: { followed?: string[]; minUsd?: number }) {
  const { events, connected, fallback } = useWhaleActivityStream({ followed, minUsd });

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/40 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Live activity</span>
          {connected && !fallback && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              SSE
            </span>
          )}
          {fallback && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <WifiOff size={9} /> polling fallback
            </span>
          )}
          {!connected && !fallback && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <Radio size={9} /> connecting…
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-600">min {fmtUsd(minUsd)}</span>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Waiting for activity over {fmtUsd(minUsd)}…
        </div>
      ) : (
        <ul className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="px-3 py-2 hover:bg-white/[0.02] text-xs flex items-center gap-3">
              <span className={`uppercase text-[9px] font-semibold w-14 ${
                e.action === "buy" ? "text-green-400" :
                e.action === "sell" ? "text-red-400" :
                "text-slate-400"
              }`}>
                {e.action}
              </span>
              <code className="font-mono text-slate-300 flex-shrink-0">{shortAddr(e.whale_address)}</code>
              <span className="text-white font-mono">{e.token_symbol ?? "—"}</span>
              <span className="text-slate-300 font-mono">{fmtUsd(e.value_usd)}</span>
              <span className="flex-1 truncate text-slate-500">{e.counterparty_label ?? ""}</span>
              <span className="text-[10px] text-slate-600">{new Date(e.timestamp).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LiveActivityFeed;
