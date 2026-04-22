'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Code, Search, AlertTriangle, CheckCircle, XCircle,
  Shield, Loader2, Info, ChevronDown, ChevronUp, Brain, ThumbsUp, ThumbsDown,
  TrendingUp, TrendingDown, ShieldAlert, ExternalLink
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface AnalysisResult {
  address: string;
  chain: string;
  overallScore: number;
  verdict: string;
  verdictColor: string;
  riskFlags: string[];
  tokenSecurity: {
    isHoneypot: boolean;
    buyTax: string;
    sellTax: string;
    isOpenSource: boolean;
    isMintable: boolean;
    isProxy: boolean;
    hasHiddenOwner: boolean;
    canTakeBackOwnership: boolean;
    ownerCanChangeBalance: boolean;
    selfDestruct: boolean;
    externalCall: boolean;
    cannotBuy: boolean;
    cannotSellAll: boolean;
    holderCount: number;
    ownerAddress: string;
    creatorAddress: string;
    checks: { label: string; status: string }[];
  } | null;
  addressIntel: {
    riskLevel: string;
    riskScore: number;
    isBlacklisted: boolean;
    isMalicious: boolean;
    isPhishing: boolean;
    isMixer: boolean;
    labels: string[];
  } | null;
  dexData?: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
    fdv: number;
    marketCap: number;
    imageUrl?: string;
    symbol?: string;
    name?: string;
    url?: string;
  } | null;
  analyzedAt: string;
  aiAnalysis?: string;
}

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'bsc', label: 'BSC' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'avalanche', label: 'Avalanche' },
  { id: 'solana', label: 'Solana' },
];

export default function ContractAnalyzerPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChecks, setShowChecks] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<'up' | 'down' | null>(null);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/security/contract-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: input.trim(), chain }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Analysis failed'); return; }
      setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Code className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold">Contract Analyzer</h1>
            <p className="text-[10px] text-gray-500">Deep contract security analysis and rug detection</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[#0A1EFF]/5 border border-[#0A1EFF]/20 rounded-2xl p-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#0A1EFF] mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Analyze any smart contract or token address for honeypot risk, dangerous permissions, high taxes, and malicious patterns.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {CHAINS.map((c) => (
            <button key={c.id} onClick={() => setChain(c.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${chain === c.id ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/30 text-blue-300' : 'bg-[#0f1320] border-[#1a1f2e] text-gray-500 hover:text-gray-300'}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            placeholder="Contract or token address (0x... or Solana)"
            className="flex-1 bg-[#0f1320] border border-[#1a1f2e] rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
          />
          <button onClick={handleAnalyze} disabled={analyzing || !input.trim()}
            className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Analyze
          </button>
        </div>

        {analyzing && (
          <div className="text-center py-12">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#0A1EFF]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0A1EFF] animate-spin" />
              <Code className="w-6 h-6 text-[#0A1EFF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Analyzing contract...</p>
            <p className="text-[10px] text-gray-600 mt-1">Running honeypot detection, security checks, and risk analysis</p>
          </div>
        )}

        {error && !analyzing && (
          <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/20 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {result && !analyzing && (
          <>
            {/* Token Header with DexScreener data */}
            {result.dexData && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                <div className="flex items-center gap-3 mb-3">
                  {result.dexData.imageUrl ? (
                    <img src={result.dexData.imageUrl} alt={result.dexData.symbol} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-10 h-10 bg-[#0A1EFF]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Code className="w-5 h-5 text-[#0A1EFF]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{result.dexData.name || result.dexData.symbol || 'Token'}</span>
                      {result.dexData.symbol && <span className="text-[10px] text-gray-500 font-mono">{result.dexData.symbol}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono font-bold">
                        ${result.dexData.price < 0.01 ? result.dexData.price.toFixed(8) : result.dexData.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                      <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${result.dexData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {result.dexData.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {result.dexData.priceChange24h >= 0 ? '+' : ''}{result.dexData.priceChange24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  {result.dexData.url && (
                    <a href={result.dexData.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#0A1EFF] flex items-center gap-1 hover:underline flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#060A12] rounded-xl p-2">
                    <p className="text-[9px] text-gray-500">MCap</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.marketCap > 1e6 ? (result.dexData.marketCap / 1e6).toFixed(2) + 'M' : result.dexData.marketCap > 1000 ? (result.dexData.marketCap / 1000).toFixed(1) + 'K' : result.dexData.marketCap.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2">
                    <p className="text-[9px] text-gray-500">Volume 24h</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.volume24h > 1e6 ? (result.dexData.volume24h / 1e6).toFixed(2) + 'M' : result.dexData.volume24h > 1000 ? (result.dexData.volume24h / 1000).toFixed(1) + 'K' : result.dexData.volume24h.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2">
                    <p className="text-[9px] text-gray-500">Liquidity</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.liquidity > 1e6 ? (result.dexData.liquidity / 1e6).toFixed(2) + 'M' : result.dexData.liquidity > 1000 ? (result.dexData.liquidity / 1000).toFixed(1) + 'K' : result.dexData.liquidity.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Score Card */}
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#1a2235" strokeWidth="6" />
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke={result.verdictColor}
                      strokeWidth="6"
                      strokeDasharray={`${(result.overallScore / 100) * (2 * Math.PI * 32)} ${2 * Math.PI * 32}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold" style={{ color: result.verdictColor }}>{result.overallScore}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold mb-0.5" style={{ color: result.verdictColor }}>{result.verdict}</div>
                  <p className="text-[11px] text-gray-400 font-mono">{result.address.slice(0, 8)}...{result.address.slice(-6)}</p>
                  <p className="text-[10px] text-gray-600 mt-1 capitalize">{result.chain} Network</p>
                  {/* Color-coded score bar */}
                  <div className="mt-2">
                    <div className="w-full h-2 rounded-full bg-[#1a2235] overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{
                          width: `${result.overallScore}%`,
                          background: `linear-gradient(to right, #EF4444, #F59E0B, #10B981)`,
                          clipPath: `inset(0 ${100 - result.overallScore}% 0 0)`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                      <span>0</span><span>50</span><span>100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Flags */}
            {result.riskFlags.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/20">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Risk Flags ({result.riskFlags.length})
                </h3>
                <div className="space-y-2">
                  {result.riskFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[12px] text-gray-300">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Token Security Details */}
            {result.tokenSecurity && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                <h3 className="font-bold text-sm mb-3">Token Security Details</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Honeypot</p>
                    <p className={`text-xs font-bold ${result.tokenSecurity.isHoneypot ? 'text-red-400' : 'text-emerald-400'}`}>
                      {result.tokenSecurity.isHoneypot ? 'Detected' : 'None'}
                    </p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Buy Tax</p>
                    <p className="text-xs font-bold">{result.tokenSecurity.buyTax}</p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Sell Tax</p>
                    <p className="text-xs font-bold">{result.tokenSecurity.sellTax}</p>
                  </div>
                  <div className="bg-[#060A12] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Holders</p>
                    <p className="text-xs font-bold">{result.tokenSecurity.holderCount.toLocaleString()}</p>
                  </div>
                </div>

                <button onClick={() => setShowChecks(!showChecks)}
                  className="w-full flex items-center justify-between py-2 text-xs text-gray-400 hover:text-white transition-colors">
                  <span>Full Security Checklist</span>
                  {showChecks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showChecks && (
                  <div className="space-y-2 border-t border-[#1a1f2e] pt-3">
                    {result.tokenSecurity.checks.map((check, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className="text-[11px] text-gray-400">{check.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Address Intel */}
            {result.addressIntel && result.addressIntel.labels.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                <h3 className="font-bold text-sm mb-3">Intelligence Flags</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: result.addressIntel.riskLevel === 'SAFE' ? '#10B98115' : result.addressIntel.riskLevel === 'CRITICAL' ? '#EF444415' : '#F59E0B15',
                      color: result.addressIntel.riskLevel === 'SAFE' ? '#10B981' : result.addressIntel.riskLevel === 'CRITICAL' ? '#EF4444' : '#F59E0B',
                    }}>
                    {result.addressIntel.riskLevel}
                  </span>
                  <span className="text-[10px] text-gray-500">Intelligence Risk Score: {result.addressIntel.riskScore}/100</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.addressIntel.labels.map((label) => (
                    <span key={label} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{label}</span>
                  ))}
                </div>
              </div>
            )}

            {result.riskFlags.length === 0 && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">No major risks detected</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Contract passed all security checks. Always do your own research.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Security Assessment Summary */}
            <div className="bg-[#0A0E1A] rounded-2xl p-4 border border-[#0A1EFF]/20 bg-gradient-to-br from-[#0A1EFF]/5 to-transparent">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-[#0A1EFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-[#0A1EFF]" />
                </div>
                <span className="font-bold text-sm">Security Assessment Summary</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                  result.overallScore >= 80
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                    : result.overallScore >= 55
                    ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                    : result.overallScore >= 35
                    ? 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30'
                    : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                }`}>
                  {result.overallScore >= 80 ? 'LOW RISK' : result.overallScore >= 55 ? 'MEDIUM RISK' : result.overallScore >= 35 ? 'HIGH RISK' : 'CRITICAL'}
                </span>
              </div>

              {/* Written summary paragraph — real AI if available */}
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                {result.aiAnalysis ? (
                  <div className="space-y-1.5">
                    {result.aiAnalysis.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className={`text-xs leading-relaxed ${
                        line.startsWith('ASSESSMENT:') ? 'text-gray-300 font-medium' :
                        line.startsWith('KEY RISKS:') ? 'text-amber-400 font-semibold mt-1' :
                        line.startsWith('VERDICT:') ? 'text-white font-bold mt-1' :
                        line.startsWith('•') || line.startsWith('-') ? 'text-gray-400 pl-2' :
                        'text-gray-300'
                      }`}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {result.overallScore >= 80
                      ? `Contract scored ${result.overallScore}/100 — ${result.riskFlags.length === 0 ? 'no risk flags detected' : `${result.riskFlags.length} minor flag(s) noted`}. Appears safe for interaction, though DYOR always applies.`
                      : result.overallScore >= 55
                      ? `Contract scored ${result.overallScore}/100 with ${result.riskFlags.length} risk flag(s). ${result.tokenSecurity?.isHoneypot ? 'Honeypot pattern identified. ' : ''}Exercise caution before interacting.`
                      : result.overallScore >= 35
                      ? `Significant issues — score ${result.overallScore}/100. ${result.riskFlags.slice(0, 2).join('. ')}. High caution advised.`
                      : `CRITICAL RISK (${result.overallScore}/100): ${result.riskFlags.slice(0, 3).join('. ')}. Do not interact.`
                    }
                  </p>
                )}
              </div>

              {/* Risk breakdown bars */}
              {result.tokenSecurity && (
                <div className="mb-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Risk Breakdown</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Honeypot Risk', value: result.tokenSecurity.isHoneypot ? 100 : 0, color: result.tokenSecurity.isHoneypot ? '#EF4444' : '#10B981' },
                      { label: 'Ownership Risk', value: (result.tokenSecurity.hasHiddenOwner ? 40 : 0) + (result.tokenSecurity.canTakeBackOwnership ? 35 : 0) + (result.tokenSecurity.ownerCanChangeBalance ? 25 : 0), color: (result.tokenSecurity.hasHiddenOwner || result.tokenSecurity.canTakeBackOwnership || result.tokenSecurity.ownerCanChangeBalance) ? '#F59E0B' : '#10B981' },
                      { label: 'Contract Security', value: Math.max(0, 100 - result.overallScore), color: result.overallScore >= 70 ? '#10B981' : result.overallScore >= 45 ? '#F59E0B' : '#EF4444' },
                      { label: 'Tax Exposure', value: Math.min(100, (parseFloat(result.tokenSecurity.buyTax) || 0) + (parseFloat(result.tokenSecurity.sellTax) || 0)), color: ((parseFloat(result.tokenSecurity.buyTax) || 0) + (parseFloat(result.tokenSecurity.sellTax) || 0)) > 15 ? '#EF4444' : ((parseFloat(result.tokenSecurity.buyTax) || 0) + (parseFloat(result.tokenSecurity.sellTax) || 0)) > 5 ? '#F59E0B' : '#10B981' },
                    ].map((bar) => (
                      <div key={bar.label}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-400">{bar.label}</span>
                          <span className="font-semibold" style={{ color: bar.color }}>{bar.value}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${bar.value}%`, backgroundColor: bar.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <p className="text-[10px] text-gray-600">Was this assessment helpful?</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAiFeedback(prev => prev === 'up' ? null : 'up')}
                    className={`p-1.5 rounded-lg transition-colors ${aiFeedback === 'up' ? 'text-[#10B981] bg-[#10B981]/10' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAiFeedback(prev => prev === 'down' ? null : 'down')}
                    className={`p-1.5 rounded-lg transition-colors ${aiFeedback === 'down' ? 'text-[#EF4444] bg-[#EF4444]/10' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button onClick={() => { setResult(null); setInput(''); }}
              className="w-full bg-[#0f1320] border border-[#1a1f2e] hover:border-[#0A1EFF]/30 py-2.5 rounded-xl text-xs text-gray-400 hover:text-white transition-all">
              Analyze another contract
            </button>
          </>
        )}

        {!result && !analyzing && !error && (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0A1EFF]/10 flex items-center justify-center">
              <Code className="w-8 h-8 text-[#0A1EFF]/60" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">Enter a contract address to analyze</h3>
            <p className="text-[11px] text-gray-600 mt-1.5 max-w-[260px] mx-auto">
              Detect honeypots, rug pulls, dangerous permissions, and contract risks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
