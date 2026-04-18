"use client";

import { useState } from "react";
import { Shield, Loader2, BellPlus } from "lucide-react";
import { SecurityReport, type RiskAssessmentView } from "@/components/security/SecurityReport";
import { toast } from "sonner";

type ScanType = "token" | "address";

const CHAINS = ["ethereum", "base", "arbitrum", "polygon", "bsc", "optimism", "avalanche"];

export default function SecurityScannerPage() {
  const [scanType, setScanType] = useState<ScanType>("token");
  const [chain, setChain] = useState("ethereum");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<(RiskAssessmentView & { target: string; scan_type: ScanType }) | null>(null);

  async function scan() {
    if (!target.trim()) {
      toast.error("Enter a token or address");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_type: scanType, target: target.trim(), chain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      setResult({ ...json, target: target.trim(), scan_type: scanType });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  async function subscribe() {
    if (!result) return;
    const res = await fetch("/api/security/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: result.scan_type,
        target: result.target,
        chain,
        notify_on_level: "high",
      }),
    });
    if (res.ok) toast.success("Alert subscribed");
    else toast.error("Subscribe failed");
  }

  const input =
    "w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-sm font-mono focus:outline-none focus:border-blue-500/40";

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield size={22} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Security Scanner</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Deep contract + address risk analysis powered by GoPlus. Every scan is logged to your history.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setScanType("token")}
              className={`py-2 text-xs uppercase tracking-wide rounded-lg border transition ${
                scanType === "token" ? "bg-blue-500/15 border-blue-500/40 text-blue-300" : "border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              Token contract
            </button>
            <button
              onClick={() => setScanType("address")}
              className={`py-2 text-xs uppercase tracking-wide rounded-lg border transition ${
                scanType === "address" ? "bg-blue-500/15 border-blue-500/40 text-blue-300" : "border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              Wallet address
            </button>
          </div>
          <div className="flex gap-2">
            <select value={chain} onChange={(e) => setChain(e.target.value)} className={`${input} max-w-[140px] capitalize`}>
              {CHAINS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") scan();
              }}
              placeholder={scanType === "token" ? "0x… contract address" : "0x… wallet address"}
              className={`${input} flex-1`}
            />
            <button
              onClick={scan}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-sm font-semibold transition flex items-center gap-2"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Scan
            </button>
          </div>
        </div>

        {result && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Risk report</p>
              <button
                onClick={subscribe}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/30 text-slate-300 transition"
              >
                <BellPlus size={11} /> Alert me on changes
              </button>
            </div>
            <SecurityReport target={result.target} scanType={result.scan_type} assessment={result} />
          </div>
        )}
      </div>
    </div>
  );
}
