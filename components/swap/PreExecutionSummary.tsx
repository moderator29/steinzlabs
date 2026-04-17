"use client";

import { Shield, AlertTriangle, Zap } from "lucide-react";

interface PreExecutionSummaryProps {
  expectedOutput: string;
  outputSymbol: string;
  priceImpactBps: number | null;
  slippageBps: number;
  gasUsd: number | null;
  mevProtected: boolean;
  liquidityUsd?: number | null;
  provider: string;
}

export function PreExecutionSummary({
  expectedOutput,
  outputSymbol,
  priceImpactBps,
  slippageBps,
  gasUsd,
  mevProtected,
  liquidityUsd,
  provider,
}: PreExecutionSummaryProps) {
  const highImpact = priceImpactBps !== null && priceImpactBps > 200;
  const highSlippage = slippageBps > 500;
  const lowLiq = liquidityUsd !== null && liquidityUsd !== undefined && liquidityUsd < 50_000;

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-4 space-y-2.5">
      <Row label="Expected output" value={`${expectedOutput} ${outputSymbol}`} mono />
      <Row
        label="Price impact"
        value={priceImpactBps !== null ? `${(priceImpactBps / 100).toFixed(2)}%` : "—"}
        danger={highImpact}
      />
      <Row label="Slippage tolerance" value={`${(slippageBps / 100).toFixed(2)}%`} danger={highSlippage} />
      <Row label="Network fee" value={gasUsd !== null ? `$${gasUsd.toFixed(2)}` : "—"} mono />
      <Row label="Route" value={provider} />
      <div className="flex items-center gap-2 pt-1">
        {mevProtected && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-300">
            <Shield size={9} /> MEV protected
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300">
          <Zap size={9} /> {provider}
        </span>
      </div>
      {(highImpact || lowLiq) && (
        <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <div>
            {highImpact && <p>High price impact. Consider smaller size or a limit order.</p>}
            {lowLiq && <p>Low on-chain liquidity (${liquidityUsd?.toFixed(0) ?? "?"}). Slippage may exceed estimate.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${danger ? "text-red-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

export default PreExecutionSummary;
