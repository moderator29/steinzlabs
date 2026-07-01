"use client";

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { SecurityBadge } from "@/components/security/SecurityBadge";

/** One contributing source's state, mirrored from lib/security/addressEnrich. */
export interface EnrichSourceView {
  source: "goplus" | "etherscan" | "chainabuse";
  status: "ok" | "unavailable" | "skip";
  malicious: boolean;
  detail: string;
}

export interface RiskAssessmentView {
  score: number;
  level: "safe" | "low" | "medium" | "high" | "critical";
  reasons: string[];
  sections: Record<string, { ok: boolean; detail?: string }>;
  /** Address-scan only: resolved human label from a verified source, else null. */
  label?: string | null;
  labelSource?: "known-list" | "etherscan" | null;
  /** Address-scan only: number of independent sources flagging it malicious. */
  maliciousSourceCount?: number;
  /** Address-scan only: community scam reports (Chainabuse), null when unavailable. */
  scamReportCount?: number | null;
  /** Address-scan only: per-source corroboration for transparency. */
  sources?: EnrichSourceView[];
}

const SOURCE_LABELS: Record<EnrichSourceView["source"], string> = {
  goplus: "Security Scanner",
  etherscan: "Etherscan labels",
  chainabuse: "Chainabuse reports",
};

const SECTION_LABELS: Record<string, string> = {
  honeypot: "Honeypot check",
  tax: "Buy / sell tax",
  ownership: "Ownership & mint powers",
  tradingRestrictions: "Trading restrictions",
  liquidity: "DEX liquidity",
  holders: "Holder distribution",
  contractCode: "Contract code",
  similarScams: "Similar scam matches",
  scam: "Scam registry",
  blacklist: "Blacklist registries",
  sanctions: "Sanctions lists",
  phishing: "Phishing history",
};

export function SecurityReport({
  target,
  scanType,
  assessment,
}: {
  target: string;
  scanType: "token" | "address";
  assessment: RiskAssessmentView;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 p-4 rounded-xl nl-glass" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{scanType} scan</p>
          <code className="text-sm font-mono text-white truncate block">{target}</code>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SecurityBadge score={assessment.score} level={assessment.level} size="md" />
          <p className="text-[10px] text-slate-500">Score {assessment.score} / 100</p>
        </div>
      </div>

      {assessment.label && (
        <div className="p-3 rounded-xl nl-glass flex items-center justify-between gap-3" style={{ boxShadow: '0 0 0 1px rgba(139,124,255,.35)' }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Resolved identity</p>
            <p className="text-sm font-semibold text-white truncate">{assessment.label}</p>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#8B7CFF]/10 border border-[#8B7CFF]/30 text-[#8B7CFF] font-mono flex-shrink-0">
            {assessment.labelSource === "etherscan" ? "verified name" : "known list"}
          </span>
        </div>
      )}

      {assessment.sources && assessment.sources.length > 0 && (
        <div className="rounded-xl nl-glass p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Source corroboration</p>
            {(assessment.maliciousSourceCount ?? 0) > 1 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 font-mono">
                {assessment.maliciousSourceCount} sources agree
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {assessment.sources.map((s) => (
              <div key={s.source} className="flex items-start gap-2">
                {s.status === "unavailable" ? (
                  <AlertTriangle size={12} className="text-slate-500 flex-shrink-0 mt-0.5" />
                ) : s.malicious ? (
                  <XCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white">{SOURCE_LABELS[s.source]}</p>
                  <p className="text-[10px] text-slate-400">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assessment.reasons.length > 0 && (
        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-red-300 mb-1 uppercase tracking-wide">Flagged reasons</p>
            <div className="flex flex-wrap gap-1.5">
              {assessment.reasons.map((r) => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 font-mono">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl nl-glass divide-y divide-white/10" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
        {Object.entries(assessment.sections).map(([key, section]) => (
          <div key={key} className="flex items-start gap-3 p-3 hover:bg-white/[0.02]">
            {section.ok ? (
              <CheckCircle2 size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">{SECTION_LABELS[key] ?? key}</p>
              {section.detail && <p className="text-[11px] text-slate-400 mt-0.5">{section.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
