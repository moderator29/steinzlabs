'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Key, Search, AlertTriangle, CheckCircle,
  XCircle, Loader2, Info, ExternalLink, Shield, ShieldAlert,
} from 'lucide-react';
import type { ApprovalResult } from '@/app/api/security/approvals/route';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalResponse {
  approvals: ApprovalResult[];
  totalRisk: 'safe' | 'warning' | 'danger';
  unlimitedCount: number;
  dangerCount: number;
  scannedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', chainId: 1 },
  { id: 'bsc', label: 'BSC', chainId: 56 },
  { id: 'polygon', label: 'Polygon', chainId: 137 },
  { id: 'base', label: 'Base', chainId: 8453 },
  { id: 'arbitrum', label: 'Arbitrum', chainId: 42161 },
];

const REVOKE_BASE = 'https://revoke.cash';

function getRevokeUrl(address: string, chainId: number): string {
  return `${REVOKE_BASE}/address/${address}?chainId=${chainId}`;
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: 'safe' | 'warning' | 'danger' }) {
  if (level === 'danger') {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
        DANGER
      </span>
    );
  }
  if (level === 'warning') {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Unlimited
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      Safe
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalManagerPage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApprovalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedChain = CHAINS.find(c => c.id === chain) ?? CHAINS[0];

  const handleScan = async () => {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/security/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, chain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Scan failed. Please try again.');
        return;
      }
      setResponse(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#7C3AED] to-[#0A1EFF] rounded-xl flex items-center justify-center">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold">Approval Manager</h1>
            <p className="text-[10px] text-gray-500">Scan and manage token spending approvals</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info banner */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Token approvals allow contracts to spend your tokens. Unlimited approvals are a security risk — revoke any you no longer need.
          </p>
        </div>

        {/* Chain selector */}
        <div className="flex gap-2 flex-wrap">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChain(c.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                chain === c.id
                  ? 'bg-[#7C3AED]/10 border-[#7C3AED]/30 text-[#7C3AED]'
                  : 'bg-[#0f1320] border-[#1a1f2e] text-gray-500 hover:text-gray-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="Wallet address (0x...)"
            className="flex-1 bg-[#0f1320] border border-[#1a1f2e] rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#7C3AED]/40"
          />
          <button
            onClick={handleScan}
            disabled={loading || !address.trim()}
            className="bg-gradient-to-r from-[#7C3AED] to-[#0A1EFF] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Scan
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-10">
            <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Scanning token approvals...</p>
            <p className="text-[10px] text-gray-600 mt-1">Analyzing ERC-20 interaction history</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/20 text-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {response && !loading && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0f1320] rounded-2xl p-3 border border-[#1a1f2e] text-center">
                <p className="text-xl font-bold">{response.approvals.length}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Total</p>
              </div>
              <div className="bg-[#0f1320] rounded-2xl p-3 border border-amber-500/20 text-center">
                <p className="text-xl font-bold text-amber-400">{response.unlimitedCount}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Unlimited</p>
              </div>
              <div className="bg-[#0f1320] rounded-2xl p-3 border border-red-500/20 text-center">
                <p className="text-xl font-bold text-red-400">{response.dangerCount}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Dangerous</p>
              </div>
            </div>

            {/* Revoke CTA */}
            <a
              href={getRevokeUrl(address.trim(), selectedChain.chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-gradient-to-r from-[#7C3AED]/10 to-[#0A1EFF]/10 border border-[#7C3AED]/20 rounded-2xl p-4 hover:border-[#7C3AED]/40 transition-all"
            >
              <div>
                <p className="text-sm font-bold">Revoke Approvals</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Manage and revoke all approvals on revoke.cash</p>
              </div>
              <ExternalLink className="w-5 h-5 text-[#7C3AED] flex-shrink-0" />
            </a>

            {/* Approval list */}
            {response.approvals.length > 0 ? (
              <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] overflow-hidden">
                <div className="p-4 border-b border-[#1a1f2e] flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">Active Approvals</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Contracts with access to your tokens</p>
                  </div>
                  {response.totalRisk === 'danger' && (
                    <div className="flex items-center gap-1.5 text-red-400">
                      <ShieldAlert className="w-4 h-4" />
                      <span className="text-[10px] font-bold">HIGH RISK</span>
                    </div>
                  )}
                  {response.totalRisk === 'warning' && (
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-[10px] font-bold">REVIEW NEEDED</span>
                    </div>
                  )}
                  {response.totalRisk === 'safe' && (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-[10px] font-bold">ALL SAFE</span>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-[#1a1f2e]">
                  {response.approvals.map((approval, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1a1f2e] flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-gray-400">
                          {(approval.tokenSymbol || '??').slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">{approval.tokenSymbol}</p>
                          {approval.spenderRisk?.isMalicious && (
                            <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{approval.spenderLabel}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <RiskBadge level={approval.riskLevel} />
                        <p className="text-[9px] text-gray-600 font-mono">{approval.allowance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-[#0f1320] rounded-2xl p-6 border border-emerald-500/20 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-emerald-400">No active approvals detected</p>
                <p className="text-[11px] text-gray-500 mt-1">This wallet has a clean approval history on {selectedChain.label}</p>
              </div>
            )}

            {/* Safety tips */}
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#7C3AED]" />
                Approval Safety Rules
              </h3>
              <div className="space-y-2">
                {[
                  'Revoke unlimited approvals from protocols you no longer use',
                  'Never approve unlimited spending from unknown contracts',
                  'Revoke approvals immediately after completing a swap',
                  'Use hardware wallets for high-value approval management',
                  'Any approval from a DANGER-flagged spender should be revoked immediately',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]/60 mt-1.5 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-gray-600 text-center">
              Scanned {response.approvals.length} unique token contracts • {new Date(response.scannedAt).toLocaleTimeString()}
            </p>
          </>
        )}

        {/* Empty state */}
        {!response && !loading && !error && (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
              <Key className="w-8 h-8 text-[#7C3AED]/60" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">Enter your wallet address</h3>
            <p className="text-[11px] text-gray-600 mt-1.5 max-w-[260px] mx-auto">
              Detect active token approvals that expose your funds to risk
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
