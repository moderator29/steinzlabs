'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileCode, Search, AlertTriangle, CheckCircle,
  XCircle, Shield, Loader2, Info, ChevronDown, ChevronUp
} from 'lucide-react';

interface DecodeResult {
  functionName: string;
  humanReadable: string;
  params: { name: string; type: string; value: string }[];
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  riskFlags: string[];
  summary: string;
  inputData: string;
  chain: string;
  decodedAt: string;
}

const RISK_CONFIG = {
  SAFE: { color: '#10B981', icon: CheckCircle, label: 'Safe', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  WARNING: { color: '#F59E0B', icon: AlertTriangle, label: 'Warning', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  DANGER: { color: '#EF4444', icon: XCircle, label: 'Dangerous', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'bsc', label: 'BSC' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'avalanche', label: 'Avalanche' },
];

const EXAMPLES = [
  {
    label: 'ERC-20 Approve',
    data: '0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25eff0000000000000000000000000000000000000000000000000000000000000064',
  },
  {
    label: 'ERC-20 Transfer',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d4c9f3b4f96c5f420000000000000000000000000000000000000000000000000de0b6b3a7640000',
  },
];

export default function SignatureInsightPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [decoding, setDecoding] = useState(false);
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);

  const handleDecode = async () => {
    const data = input.trim();
    if (!data) return;
    setDecoding(true);
    setError(null);
    setResult(null);
    setShowParams(false);

    try {
      const res = await fetch('/api/security/signature-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, chain }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Decode failed');
        return;
      }
      setResult(json);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDecoding(false);
    }
  };

  const config = result ? RISK_CONFIG[result.riskLevel] : null;

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#7C3AED] to-[#0A1EFF] rounded-xl flex items-center justify-center">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold">Signature Insight</h1>
            <p className="text-[10px] text-gray-500">Decode and analyze transaction signatures</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Banner */}
        <div className="bg-[#7C3AED]/5 border border-[#7C3AED]/20 rounded-2xl p-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#7C3AED] mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Paste any transaction calldata or signature to decode what it does in plain English.
            Detect hidden approvals, dangerous permissions, and malicious patterns before signing.
          </p>
        </div>

        {/* Chain Selector */}
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
        <div className="space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste transaction calldata (e.g. 0x095ea7b3...)"
            rows={4}
            className="w-full bg-[#0f1320] border border-[#1a1f2e] rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#7C3AED]/40 resize-none"
          />
          <button
            onClick={handleDecode}
            disabled={decoding || !input.trim()}
            className="w-full bg-gradient-to-r from-[#7C3AED] to-[#0A1EFF] py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {decoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
            {decoding ? 'Decoding...' : 'Decode Signature'}
          </button>
        </div>

        {/* Examples */}
        {!result && !decoding && (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-600">Example signatures:</p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setInput(ex.data)}
                className="w-full text-left bg-[#0f1320] border border-[#1a1f2e] hover:border-[#7C3AED]/20 rounded-xl p-3 transition-all"
              >
                <p className="text-[11px] font-semibold text-gray-300 mb-1">{ex.label}</p>
                <p className="text-[10px] text-gray-600 font-mono truncate">{ex.data.slice(0, 40)}...</p>
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {decoding && (
          <div className="text-center py-12">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#7C3AED]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
              <FileCode className="w-6 h-6 text-[#7C3AED] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Decoding transaction data...</p>
            <p className="text-[10px] text-gray-600 mt-1">Analyzing function calls and parameters</p>
          </div>
        )}

        {/* Error */}
        {error && !decoding && (
          <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/20 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && config && !decoding && (
          <>
            {/* Risk verdict */}
            <div className={`rounded-2xl p-4 border ${config.border} ${config.bg}`}>
              <div className="flex items-start gap-3">
                <config.icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold" style={{ color: config.color }}>{config.label}</span>
                    <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                      {result.inputData}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{result.functionName}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{result.humanReadable}</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <h3 className="font-bold text-sm mb-2">What this transaction does</h3>
              <p className="text-[12px] text-gray-400 leading-relaxed">{result.summary}</p>
            </div>

            {/* Risk Flags */}
            {result.riskFlags.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Risk Flags ({result.riskFlags.length})
                </h3>
                <div className="space-y-2">
                  {result.riskFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-white/[0.03] last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      <span className="text-[12px] text-gray-300">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters */}
            {result.params.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] overflow-hidden">
                <button
                  onClick={() => setShowParams(!showParams)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm font-bold">Parameters ({result.params.length})</span>
                  {showParams ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {showParams && (
                  <div className="px-4 pb-4 space-y-2 border-t border-[#1a1f2e]">
                    {result.params.map((p, i) => (
                      <div key={i} className="bg-[#060A12] rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-[#7C3AED]">{p.type}</span>
                          <span className="text-[11px] font-semibold text-gray-300">{p.name}</span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-500 break-all">{p.value || '(empty)'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Safety Tips */}
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#7C3AED]" />
                Before Signing
              </h3>
              <div className="space-y-2">
                {[
                  'Never sign unlimited approvals unless you fully trust the contract',
                  'Verify the target contract address on a block explorer',
                  'Use a hardware wallet for high-value transactions',
                  'Revoke approvals you no longer need at revoke.cash',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]/60 mt-1.5 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setInput(''); }}
              className="w-full bg-[#0f1320] border border-[#1a1f2e] hover:border-[#7C3AED]/30 py-2.5 rounded-xl text-xs text-gray-400 hover:text-white transition-all"
            >
              Decode another signature
            </button>
          </>
        )}

        {/* Empty State */}
        {!result && !decoding && !error && (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
              <FileCode className="w-8 h-8 text-[#7C3AED]/60" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">Paste calldata to decode</h3>
            <p className="text-[11px] text-gray-600 mt-1.5 max-w-[260px] mx-auto">
              Understand exactly what any transaction will do before you approve or sign it
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
