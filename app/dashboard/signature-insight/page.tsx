'use client';

import { useState } from 'react';
import {
  FileCode, Search, AlertTriangle, CheckCircle,
  XCircle, Shield, Loader2, Info, ChevronDown, ChevronUp,
  PenLine, Hash, ArrowDownLeft, ArrowUpRight, KeyRound, Hexagon,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { signatureInsightHowItWorks } from '@/lib/howItWorks/content/signature-insight';

type Mode = 'auto' | 'calldata' | 'typed';

interface AssetChange {
  assetType: string;
  changeType: string;
  direction: 'in' | 'out' | 'approve';
  amount: string;
  symbol: string | null;
  name: string | null;
  contractAddress: string | null;
  to: string;
  logo: string | null;
}

interface AssetDiff {
  available: boolean;
  reason?: string;
  changes?: AssetChange[];
  gasUsed?: string | null;
  error?: string | null;
}

interface DecodeResult {
  mode?: 'calldata' | 'typed-data';
  standard?: string;
  source?: string;
  selector?: string;
  signature?: string | null;
  functionName: string;
  humanReadable: string;
  params: { name: string; type: string; value: string }[];
  domain?: { name: string; type: string; value: string }[];
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  riskFlags: string[];
  summary: string;
  eip712Digest?: string | null;
  spender?: string | null;
  deadline?: string | null;
  inputData?: string;
  chain: string;
  decodedAt: string;
  assetDiff?: AssetDiff;
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

const MODES: { id: Mode; label: string; icon: typeof FileCode }[] = [
  { id: 'auto', label: 'Auto detect', icon: Search },
  { id: 'calldata', label: 'Raw calldata', icon: Hexagon },
  { id: 'typed', label: 'Typed data', icon: PenLine },
];

const CALLDATA_EXAMPLES = [
  {
    label: 'ERC-20 Approve',
    data: '0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25eff0000000000000000000000000000000000000000000000000000000000000064',
  },
  {
    label: 'setApprovalForAll (NFT)',
    data: '0xa22cb4650000000000000000000000001e0049783f008a0085193e00003d00cd54003c710000000000000000000000000000000000000000000000000000000000000001',
  },
];

const TYPED_EXAMPLE = JSON.stringify(
  {
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    primaryType: 'Permit',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      owner: '0x1111111111111111111111111111111111111111',
      spender: '0x2222222222222222222222222222222222222222',
      value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      nonce: '0',
      deadline: '1999999999',
    },
  },
  null,
  2
);

function short(a: string): string {
  if (!a || a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function SignatureInsightPage() {
  const [mode, setMode] = useState<Mode>('auto');
  const [input, setInput] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [fromAddr, setFromAddr] = useState('');
  const [toAddr, setToAddr] = useState('');
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
        body: JSON.stringify({
          data,
          chain,
          from: fromAddr.trim() || undefined,
          to: toAddr.trim() || undefined,
        }),
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
  const isTyped = result?.mode === 'typed-data';
  const diff = result?.assetDiff;
  const placeholder =
    mode === 'typed'
      ? 'Paste an EIP-712 typed-data JSON object (the payload from eth_signTypedData_v4)'
      : mode === 'calldata'
        ? 'Paste transaction calldata (e.g. 0x095ea7b3...)'
        : 'Paste calldata (0x...) OR an EIP-712 typed-data JSON object';

  return (
    <AuroraBackground className="min-h-screen text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 nl-glass backdrop-blur-2xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <div className="w-8 h-8 bg-gradient-to-br from-[#1E90FF] to-[#0066FF] rounded-xl flex items-center justify-center">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold">Signature Insight</h1>
            <p className="text-[10px] text-gray-500">Decode calldata and gas-less signatures before you sign</p>
          </div>
          <HowItWorksButton content={signatureInsightHowItWorks} className="ms-auto shrink-0" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Banner */}
        <TiltCard className="nl-glass border border-[#8B7CFF]/20 rounded-2xl p-3 nl-fade-up" max={4}>
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[#8B7CFF] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Decode raw calldata or an EIP-712 typed-data signature into plain English.
              Gas-less off-chain signatures (Permit, Permit2, Seaport) are the dominant drain
              vector and never show up in a wallet simulation. Catch unlimited approvals and
              hidden spenders before you sign.
            </p>
          </div>
        </TiltCard>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 nl-fade-up">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setResult(null); setError(null); }}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                mode === m.id ? 'nl-btn-neon' : 'nl-glass nl-glass--interactive text-gray-400'
              }`}
            >
              <m.icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Chain Selector */}
        <div className="flex gap-2 flex-wrap nl-fade-up">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChain(c.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                chain === c.id ? 'nl-btn-neon' : 'nl-glass nl-glass--interactive text-gray-500 hover:text-gray-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="space-y-2 nl-fade-up">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            rows={mode === 'typed' ? 8 : 4}
            className="w-full nl-glass rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#8B7CFF]/40 resize-none"
          />

          {/* Optional wallet context for the pre-sign asset-diff (calldata only) */}
          {mode !== 'typed' && (
            <div className="nl-glass rounded-xl p-3 space-y-2">
              <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-[#0066FF]" />
                Optional · add your wallet and the target contract to simulate asset changes
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={fromAddr}
                  onChange={(e) => setFromAddr(e.target.value)}
                  placeholder="From (your wallet 0x...)"
                  className="w-full bg-white/[0.03] rounded-lg px-2.5 py-2 text-[11px] font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#0066FF]/40"
                />
                <input
                  value={toAddr}
                  onChange={(e) => setToAddr(e.target.value)}
                  placeholder="To (target contract 0x...)"
                  className="w-full bg-white/[0.03] rounded-lg px-2.5 py-2 text-[11px] font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#0066FF]/40"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleDecode}
            disabled={decoding || !input.trim()}
            className="w-full nl-btn-neon py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {decoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
            {decoding ? 'Decoding...' : 'Decode'}
          </button>
        </div>

        {/* Examples */}
        {!result && !decoding && (
          <div className="space-y-2 nl-fade-up">
            <p className="text-[10px] text-gray-600">Try an example:</p>
            {(mode === 'typed' ? [{ label: 'ERC-2612 Permit · unlimited USDC', data: TYPED_EXAMPLE }] : CALLDATA_EXAMPLES).map((ex) => (
              <button
                key={ex.label}
                onClick={() => { setInput(ex.data); if (mode === 'auto' && ex.data.startsWith('{')) setMode('typed'); }}
                className="w-full text-start nl-glass nl-glass--interactive rounded-xl p-3 transition-all"
              >
                <p className="text-[11px] font-semibold text-gray-300 mb-1">{ex.label}</p>
                <p className="text-[10px] text-gray-600 font-mono truncate">{ex.data.replace(/\s+/g, ' ').slice(0, 50)}...</p>
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {decoding && (
          <div className="text-center py-12 nl-fade-up">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#8B7CFF]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#8B7CFF] animate-spin" />
              <FileCode className="w-6 h-6 text-[#8B7CFF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Decoding signature...</p>
            <p className="text-[10px] text-gray-600 mt-1">Resolving selectors and simulating asset changes</p>
          </div>
        )}

        {/* Error */}
        {error && !decoding && (
          <div className="nl-glass nl-glass--crimson rounded-2xl p-4 text-center nl-fade-up">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && config && !decoding && (
          <>
            {/* Risk verdict */}
            <TiltCard className={`nl-glass rounded-2xl p-4 border ${config.border} ${config.bg} nl-fade-up`} max={5}>
              <div className="flex items-start gap-3">
                <config.icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: config.color }}>{config.label}</span>
                    {isTyped ? (
                      <span className="text-[10px] font-semibold text-[#8B7CFF] bg-[#8B7CFF]/10 px-2 py-0.5 rounded flex items-center gap-1">
                        <PenLine className="w-3 h-3" />
                        {result.standard}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                        {result.selector || result.inputData}
                      </span>
                    )}
                    {result.source && (
                      <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">via {result.source}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white break-words">{result.functionName}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono break-all">{result.humanReadable}</p>
                </div>
              </div>
            </TiltCard>

            {/* Gas-less signature callout */}
            {isTyped && (
              <div className="nl-glass rounded-2xl p-4 border border-[#8B7CFF]/20 nl-fade-up">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#8B7CFF]" />
                  Off-chain signature
                </h3>
                <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                  This is a gas-less signature, not a transaction. Your wallet will not simulate it.
                  Signing it lets the holder act on-chain later.
                </p>
                <div className="space-y-2">
                  {result.spender && (
                    <div className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                      <span className="text-[10px] text-gray-500">Spender · zone</span>
                      <span className="text-[11px] font-mono text-gray-300">{short(result.spender)}</span>
                    </div>
                  )}
                  {result.deadline && (
                    <div className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                      <span className="text-[10px] text-gray-500">Deadline · expiration</span>
                      <span className="text-[11px] font-mono text-gray-300">{result.deadline}</span>
                    </div>
                  )}
                  {result.eip712Digest && (
                    <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-500 mb-1">EIP-712 digest (recomputed locally)</p>
                      <p className="text-[10px] font-mono text-gray-400 break-all">{result.eip712Digest}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="nl-glass rounded-2xl p-4 nl-fade-up">
              <h3 className="font-bold text-sm mb-2">What this {isTyped ? 'signature' : 'transaction'} does</h3>
              <p className="text-[12px] text-gray-400 leading-relaxed">{result.summary}</p>
            </div>

            {/* Pre-sign asset diff (calldata) */}
            {!isTyped && diff && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-[#0066FF]" />
                  Simulated asset changes
                </h3>
                {diff.available && diff.changes && diff.changes.length > 0 ? (
                  <div className="space-y-2">
                    {diff.changes.map((c, i) => {
                      const isApprove = c.direction === 'approve';
                      const isOut = c.direction === 'out';
                      const color = isApprove ? '#F59E0B' : isOut ? '#EF4444' : '#10B981';
                      const Icon = isApprove ? KeyRound : isOut ? ArrowUpRight : ArrowDownLeft;
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-gray-200 truncate">
                                {c.symbol || c.name || c.assetType || 'Asset'}
                              </p>
                              <p className="text-[9px] text-gray-600">
                                {isApprove ? `Approval to ${short(c.to)}` : isOut ? 'Leaves your wallet' : 'Arrives in your wallet'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono font-semibold flex-shrink-0" style={{ color }}>
                            {isApprove ? 'approve' : `${isOut ? '-' : '+'}${c.amount || '?'}`}
                          </span>
                        </div>
                      );
                    })}
                    {diff.gasUsed && (
                      <p className="text-[10px] text-gray-600 pt-1">Estimated gas · {parseInt(diff.gasUsed, 16) || diff.gasUsed}</p>
                    )}
                  </div>
                ) : diff.available && (!diff.changes || diff.changes.length === 0) ? (
                  <p className="text-[11px] text-gray-500">
                    Simulation ran and produced no token or NFT movement{diff.error ? `. Note · ${diff.error}` : '.'}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    {diff.reason || 'Asset simulation unavailable.'} Add your wallet and the target contract above to simulate.
                  </p>
                )}
              </div>
            )}

            {/* Risk Flags */}
            {result.riskFlags.length > 0 && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up">
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

            {/* Domain (typed data) */}
            {isTyped && result.domain && result.domain.length > 0 && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up">
                <h3 className="font-bold text-sm mb-3">EIP-712 Domain</h3>
                <div className="space-y-2">
                  {result.domain.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                      <span className="text-[10px] font-mono text-[#8B7CFF]">{d.name}</span>
                      <span className="text-[11px] font-mono text-gray-300 truncate max-w-[60%] text-right">{d.value || '(empty)'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters */}
            {result.params.length > 0 && (
              <div className="nl-glass rounded-2xl overflow-hidden nl-fade-up">
                <button
                  onClick={() => setShowParams(!showParams)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm font-bold">{isTyped ? 'Message fields' : 'Parameters'} ({result.params.length})</span>
                  {showParams ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {showParams && (
                  <div className="px-4 pb-4 space-y-2 border-t border-white/10">
                    {result.params.map((p, i) => (
                      <div key={i} className="bg-white/[0.03] rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-[#8B7CFF]">{p.type}</span>
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
            <div className="nl-glass rounded-2xl p-4 nl-fade-up">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#8B7CFF]" />
                Before Signing
              </h3>
              <div className="space-y-2">
                {[
                  'Treat a gas-less Permit or Permit2 signature like an approval. The spender can move your tokens later with no further prompt.',
                  'Never sign unlimited approvals unless you fully trust the spender contract.',
                  'Verify the verifying contract and spender address on a block explorer.',
                  'Revoke approvals and Permit2 allowances you no longer need at revoke.cash.',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF]/60 mt-1.5 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setInput(''); }}
              className="w-full nl-btn-neon py-2.5 rounded-xl text-xs font-semibold transition-all"
            >
              Decode another
            </button>
          </>
        )}

        {/* Empty State */}
        {!result && !decoding && !error && (
          <div className="text-center py-10 nl-fade-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#8B7CFF]/10 flex items-center justify-center">
              <FileCode className="w-8 h-8 text-[#8B7CFF]/60" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">Paste calldata or a typed-data signature</h3>
            <p className="text-[11px] text-gray-600 mt-1.5 max-w-[280px] mx-auto">
              Understand exactly what any transaction or off-chain signature will do before you approve it
            </p>
          </div>
        )}
      </div>
    </AuroraBackground>
  );
}
