'use client';

import { Shield, Search, AlertTriangle, CheckCircle, XCircle, Clock, Loader2, ExternalLink, Copy, Wallet, ArrowRight, Brain, ThumbsUp, ThumbsDown, ShieldAlert, HelpCircle } from 'lucide-react';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { securityCenterHowItWorks } from '@/lib/howItWorks/content/security';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useNavState } from '@/lib/nav/useNavState';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'unavailable';
type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low' | 'Safe';

interface ScanCheck {
  id: string;
  label: string;
  category: string;
  status: CheckStatus;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  evidence: string;
  source: string;
}

interface SourceStatus { name: string; ok: boolean; detail: string }

interface ScanResult {
  contract: string;
  chainId: string;
  chainLabel: string;
  resolvedChain: string;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  creatorAddress: string;
  ownerAddress: string;
  trustScore: number;
  riskScore: number;
  riskTier: RiskTier;
  safetyLevel: string;
  safetyColor: string;
  tierColor: string;
  scoreReasons: string[];
  buyTax: string;
  sellTax: string;
  isHoneypot: boolean;
  isOpenSource: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasHiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  ownerCanChangeBalance: boolean;
  lpHolders: unknown[];
  lpTotalSupply: string;
  checks: ScanCheck[];
  sources: SourceStatus[];
  reconciliation: string[];
  lpAnalysis?: { status: CheckStatus; lockedOrBurnedPct: number | null; detail: string; source: string } | null;
  timestamp: string;
  dexData?: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
    fdv: number;
    marketCap: number;
    url?: string;
  } | null;
  aiAnalysis?: string;
}

const TIER_COPY: Record<RiskTier, string> = {
  Safe: 'Passed all critical checks — no security red flags found',
  Low: 'Minor concerns only — no critical security flags',
  Medium: 'Some real risks detected — proceed with care',
  High: 'Significant risks found — high caution advised',
  Critical: 'Critical risk detected — avoid this token',
};

const CHAINS = [
  { id: '1', label: 'Ethereum', key: 'ethereum' },
  { id: '56', label: 'BSC', key: 'bsc' },
  { id: '137', label: 'Polygon', key: 'polygon' },
  { id: 'solana', label: 'Solana', key: 'solana' },
  { id: '8453', label: 'Base', key: 'base' },
  { id: '43114', label: 'Avalanche', key: 'avalanche' },
  { id: '42161', label: 'Arbitrum', key: 'arbitrum' },
];

export default function TokenScannerPage() {
  const router = useRouter();
  const [scanInput, setScanInput] = useState('');
  const [selectedChain, setSelectedChain] = useState('ethereum');
  useNavState<{ selectedChain: string }>(
    'security-token-scanner',
    () => ({ selectedChain }),
    (saved) => { if (saved.selectedChain) setSelectedChain(saved.selectedChain); },
  );
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletRejection, setWalletRejection] = useState<{ error: string; message: string; suggestion: string; redirectUrl: string } | null>(null);
  const [aiFeedback, setAiFeedback] = useState<'up' | 'down' | null>(null);

  const handleScan = async () => {
    const address = scanInput.trim();
    if (!address) return;

    setScanning(true);
    setError(null);
    setResult(null);
    setWalletRejection(null);

    try {
      const res = await fetch('/api/token-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract: address, chain: selectedChain }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isWalletAddress) {
          setWalletRejection(data);
          return;
        }
        setError(data.error || 'Failed to scan token');
        return;
      }

      // 200 with an error field = honest "could not verify" (no source returned data).
      if (data.error || data.couldNotVerify) {
        setError(data.error || 'Could not verify this token — no security source returned data.');
        return;
      }

      setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const getScoreStroke = (score: number) => {
    const circumference = 2 * Math.PI * 40;
    const filled = (score / 100) * circumference;
    return `${filled} ${circumference}`;
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr === 'N/A') return 'N/A';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const explorerUrl = (addr: string) => {
    const chain = CHAINS.find(c => c.key === selectedChain);
    if (chain?.id === '56') return `https://bscscan.com/address/${addr}`;
    if (chain?.id === '137') return `https://polygonscan.com/address/${addr}`;
    if (chain?.id === 'solana') return `https://solscan.io/token/${addr}`;
    if (chain?.id === '8453') return `https://basescan.org/address/${addr}`;
    if (chain?.id === '43114') return `https://snowtrace.io/address/${addr}`;
    if (chain?.id === '42161') return `https://arbiscan.io/address/${addr}`;
    return `https://etherscan.io/address/${addr}`;
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
  };

  return (
    <AuroraBackground fullHeight className="text-white">
    <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 nl-fade-up">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Search className="w-4 h-4 text-[#0066FF]" /> Token Scanner
          </h2>
          <HowItWorksButton content={securityCenterHowItWorks} className="ms-auto shrink-0" />
        </div>
        <div className="flex flex-wrap gap-2 nl-fade-up">
          {CHAINS.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChain(chain.key)}
              className={`rounded-xl py-2 px-3 border transition-all text-center text-xs font-semibold ${selectedChain === chain.key ? 'bg-[#0066FF]/10 border-[#0066FF]/30 text-[#0066FF]' : 'nl-button--ghost text-gray-400'}`}
            >
              {chain.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 nl-fade-up">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="Contract address (0x… / Solana mint) or token symbol"
            className="flex-1 nl-glass rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/30"
          />
          <button
            onClick={handleScan}
            disabled={scanning || !scanInput.trim()}
            className="nl-btn-neon px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Scan
          </button>
        </div>

        {scanning && (
          <div className="text-center py-12">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#0066FF]/20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0066FF] animate-spin"></div>
              <Shield className="w-6 h-6 text-[#0066FF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-400">Scanning contract security...</p>
            <p className="text-[10px] text-gray-600 mt-1">Analyzing honeypot risk, ownership, taxes, and more</p>
          </div>
        )}

        {walletRejection && !scanning && (
          <div className="nl-glass rounded-2xl p-6 text-center" style={{ boxShadow: '0 0 0 1px rgba(249,115,22,.4), 0 0 16px rgba(249,115,22,.18)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-orange-400 mb-2">{walletRejection.error}</h3>
            <p className="text-sm text-gray-400 mb-1">{walletRejection.message}</p>
            <p className="text-xs text-gray-500 mb-4">{walletRejection.suggestion}</p>
            <button
              onClick={() => router.push(`${walletRejection.redirectUrl}?address=${encodeURIComponent(scanInput.trim())}`)}
              className="nl-btn-neon inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
            >
              Go to DNA Analyzer <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-gray-600 mt-3">
              The Token Scanner only accepts smart contract addresses for security analysis.
            </p>
          </div>
        )}

        {error && !scanning && !walletRejection && (
          <div className="nl-glass nl-glass--crimson rounded-2xl p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 font-semibold">{error}</p>
            <p className="text-[10px] text-gray-500 mt-1">Check the contract address and selected chain</p>
          </div>
        )}

        {result && !scanning && (
          <>
            <TiltCard className="nl-fade-up">
            <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold">{result.name}</h2>
                  <p className="text-xs text-gray-400 font-mono">{result.symbol}</p>
                </div>
                <a
                  href={explorerUrl(result.contract)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-[#0066FF] hover:underline"
                >
                  View on Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                <span>{shortenAddress(result.contract)}</span>
                <button onClick={() => copyAddress(result.contract)} className="hover:text-white transition-colors">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
            </TiltCard>

            <div className="nl-glass rounded-2xl p-4 text-center nl-fade-up" style={{ boxShadow: `0 0 0 1px ${result.tierColor}66, 0 0 16px ${result.tierColor}30` }}>
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={result.tierColor}
                    strokeWidth="8"
                    strokeDasharray={getScoreStroke(result.riskScore ?? result.trustScore)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold leading-none" style={{ color: result.tierColor }}>{result.riskScore ?? result.trustScore}</span>
                  <span className="text-[8px] text-gray-500 mt-0.5">/ 100</span>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: result.tierColor, background: `${result.tierColor}1A`, border: `1px solid ${result.tierColor}44` }}>
                {result.riskTier} Risk
              </div>
              <p className="text-[10px] text-gray-500 mt-2">{TIER_COPY[result.riskTier] ?? ''}</p>

              {result.scoreReasons?.length > 0 && (
                <div className="mt-3 text-left bg-white/[0.03] rounded-xl p-3">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5">Why this rating</p>
                  <ul className="space-y-1">
                    {result.scoreReasons.map((r, i) => (
                      <li key={i} className="text-[11px] text-gray-300 flex gap-1.5">
                        <span className="text-gray-600">•</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.sources?.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {result.sources.map((s) => (
                    <span
                      key={s.name}
                      title={s.detail}
                      className={`text-[9px] px-2 py-0.5 rounded-full border ${s.ok ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-gray-500 border-white/10 bg-white/[0.03]'}`}
                    >
                      {s.ok ? '● ' : '○ '}{s.name}{!s.ok && s.detail ? ` · ${s.detail}` : ''}
                    </span>
                  ))}
                </div>
              )}
              {result.resolvedChain && result.chainLabel && (
                <p className="text-[9px] text-gray-600 mt-2">Analyzed on {result.chainLabel}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 nl-fade-up">
              <div className="nl-card rounded-2xl p-3">
                <p className="text-[10px] text-gray-500 mb-1">Holders</p>
                <p className="text-sm font-bold">{result.holderCount.toLocaleString()}</p>
              </div>
              <div className="nl-card rounded-2xl p-3">
                <p className="text-[10px] text-gray-500 mb-1">Honeypot</p>
                <p className={`text-sm font-bold ${result.isHoneypot ? 'text-red-400' : 'text-green-400'}`}>
                  {result.isHoneypot ? 'YES [!]' : 'NO [ok]'}
                </p>
              </div>
              <div className="nl-card rounded-2xl p-3">
                <p className="text-[10px] text-gray-500 mb-1">Buy Tax</p>
                <p className="text-sm font-bold">{result.buyTax}</p>
              </div>
              <div className="nl-card rounded-2xl p-3">
                <p className="text-[10px] text-gray-500 mb-1">Sell Tax</p>
                <p className="text-sm font-bold">{result.sellTax}</p>
              </div>
            </div>

            {result.dexData && (
              <div className="nl-glass rounded-2xl p-4 nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                <h3 className="font-bold text-sm mb-3">Market Data</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Price</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.price < 0.01 ? result.dexData.price.toFixed(8) : result.dexData.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">24h</p>
                    <p className={`text-xs font-bold ${result.dexData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {result.dexData.priceChange24h >= 0 ? '+' : ''}{result.dexData.priceChange24h.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">MCap</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.marketCap > 1e6 ? (result.dexData.marketCap / 1e6).toFixed(2) + 'M' : result.dexData.marketCap > 1000 ? (result.dexData.marketCap / 1000).toFixed(1) + 'K' : result.dexData.marketCap.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Volume</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.volume24h > 1e6 ? (result.dexData.volume24h / 1e6).toFixed(2) + 'M' : result.dexData.volume24h > 1000 ? (result.dexData.volume24h / 1000).toFixed(1) + 'K' : result.dexData.volume24h.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">Liquidity</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.liquidity > 1e6 ? (result.dexData.liquidity / 1e6).toFixed(2) + 'M' : result.dexData.liquidity > 1000 ? (result.dexData.liquidity / 1000).toFixed(1) + 'K' : result.dexData.liquidity.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500">FDV</p>
                    <p className="text-xs font-bold font-mono">
                      ${result.dexData.fdv > 1e6 ? (result.dexData.fdv / 1e6).toFixed(2) + 'M' : result.dexData.fdv > 1000 ? (result.dexData.fdv / 1000).toFixed(1) + 'K' : result.dexData.fdv.toFixed(0)}
                    </p>
                  </div>
                </div>
                {result.dexData.url && (
                  <a href={result.dexData.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 text-[10px] text-[#0066FF] hover:underline">
                    View on DexScreener <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            <div className="nl-glass rounded-2xl p-4 nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Security Checks</h3>
                <span className="text-[10px] text-gray-500">{result.checks.length} checks · every flag shows its real signal</span>
              </div>
              <div className="space-y-2.5">
                {[...result.checks]
                  .sort((a, b) => {
                    const rank = { fail: 0, warn: 1, unavailable: 2, pass: 3 } as Record<string, number>;
                    return (rank[a.status] ?? 4) - (rank[b.status] ?? 4);
                  })
                  .map((check) => {
                    const Icon = check.status === 'pass' ? CheckCircle
                      : check.status === 'fail' ? XCircle
                      : check.status === 'unavailable' ? HelpCircle : Clock;
                    const color = check.status === 'pass' ? '#10B981'
                      : check.status === 'fail' ? '#EF4444'
                      : check.status === 'unavailable' ? '#6B7280' : '#F59E0B';
                    const badge = check.status === 'pass' ? 'Pass'
                      : check.status === 'fail' ? 'Fail'
                      : check.status === 'unavailable' ? 'Unverified' : 'Warning';
                    return (
                      <div key={check.id} className="flex items-start gap-3 py-1">
                        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-200 font-medium">{check.label}</span>
                            <span className="text-[9px] font-semibold uppercase ms-auto flex-shrink-0" style={{ color }}>{badge}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{check.evidence}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[8px] text-gray-600 uppercase tracking-wide">{check.category}</span>
                            <span className="text-gray-700">·</span>
                            <span className="text-[8px] text-[#0066FF]/60">{check.source}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {result.reconciliation?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5">Source Reconciliation</p>
                  {result.reconciliation.map((r, i) => (
                    <p key={i} className="text-[10px] text-amber-400/80 leading-snug flex gap-1.5"><span>⚖</span>{r}</p>
                  ))}
                </div>
              )}

              {result.lpAnalysis && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">Liquidity:</span>
                  <span className="text-[10px] text-gray-300">{result.lpAnalysis.detail}</span>
                  <span className="text-[8px] text-[#0066FF]/60 ms-auto">{result.lpAnalysis.source}</span>
                </div>
              )}
            </div>

            <div className="nl-glass rounded-2xl p-4 nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <h3 className="font-bold text-sm mb-3">Contract Details</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Open Source</span>
                  <span className={result.isOpenSource ? 'text-green-400' : 'text-red-400'}>{result.isOpenSource ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mintable</span>
                  <span className={result.isMintable ? 'text-red-400' : 'text-green-400'}>{result.isMintable ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Proxy Contract</span>
                  <span className={result.isProxy ? 'text-yellow-400' : 'text-green-400'}>{result.isProxy ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Hidden Owner</span>
                  <span className={result.hasHiddenOwner ? 'text-red-400' : 'text-green-400'}>{result.hasHiddenOwner ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Can Reclaim Ownership</span>
                  <span className={result.canTakeBackOwnership ? 'text-red-400' : 'text-green-400'}>{result.canTakeBackOwnership ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner Changes Balance</span>
                  <span className={result.ownerCanChangeBalance ? 'text-red-400' : 'text-green-400'}>{result.ownerCanChangeBalance ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Creator</span>
                  <span className="font-mono text-gray-400">{shortenAddress(result.creatorAddress)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner</span>
                  <span className="font-mono text-gray-400">{shortenAddress(result.ownerAddress)}</span>
                </div>
              </div>
            </div>

            <div className="nl-glass rounded-2xl p-4 bg-gradient-to-br from-[#0066FF]/5 to-transparent nl-fade-up" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-[#0066FF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-[#0066FF]" />
                </div>
                <span className="font-bold text-sm">AI Security Assessment</span>
                <span
                  className="ms-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider"
                  style={{ color: result.tierColor, background: `${result.tierColor}26`, borderColor: `${result.tierColor}4D` }}
                >
                  {result.riskTier} Risk
                </span>
              </div>

              {result.aiAnalysis ? (
                <div className="bg-white/5 rounded-xl p-3 mb-3 space-y-1.5">
                  {result.aiAnalysis.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className={`text-xs leading-relaxed ${
                      line.startsWith('SUMMARY:') ? 'text-gray-300 font-medium' :
                      line.startsWith('RISKS:') ? 'text-amber-400 font-semibold mt-2' :
                      line.startsWith('VERDICT:') ? 'text-white font-bold mt-2' :
                      line.startsWith('•') || line.startsWith('-') ? 'text-gray-400 ps-2' :
                      'text-gray-300'
                    }`}>{line}</p>
                  ))}
                </div>
              ) : (
                <div className="bg-white/5 rounded-xl p-3 mb-3">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    AI narrative is unavailable for this scan. The verdict above is computed from the
                    real on-chain checks; review each security check and contract detail directly.
                  </p>
                </div>
              )}

              {(result.isHoneypot || result.isMintable || result.hasHiddenOwner || result.canTakeBackOwnership || result.ownerCanChangeBalance || result.isProxy) && (
                <div className="mb-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Specific Warnings</p>
                  <div className="space-y-1.5">
                    {result.isHoneypot && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Honeypot detected · selling transactions may be blocked
                      </div>
                    )}
                    {result.isMintable && (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Mintable supply · owner can inflate token supply at any time
                      </div>
                    )}
                    {result.hasHiddenOwner && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Hidden owner present · contract control is concealed
                      </div>
                    )}
                    {result.canTakeBackOwnership && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Ownership can be reclaimed · rugpull vector exists
                      </div>
                    )}
                    {result.ownerCanChangeBalance && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Owner can modify balances · direct theft risk
                      </div>
                    )}
                    {result.isProxy && (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Proxy contract · underlying logic can be changed by owner
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5">
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

            <p className="text-[10px] text-gray-600 text-center">
              Security analysis verified · Scanned at {new Date(result.timestamp).toLocaleTimeString()}
            </p>
          </>
        )}

        {!result && !scanning && !error && !walletRejection && (
          <div className="text-center py-8 nl-fade-up">
            <Shield className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500">Enter a contract address to scan</h3>
            <p className="text-xs text-gray-600 mt-1">Real-time security analysis and threat detection</p>
            <div className="mt-4 space-y-1">
              <p className="text-[10px] text-gray-600">Try these examples:</p>
              <button
                onClick={() => { setScanInput('0xdac17f958d2ee523a2206206994597c13d831ec7'); setSelectedChain('ethereum'); }}
                className="text-[10px] text-[#0066FF]/60 hover:text-[#0066FF] font-mono block mx-auto"
              >
                USDT (Ethereum)
              </button>
              <button
                onClick={() => { setScanInput('0x55d398326f99059ff775485246999027b3197955'); setSelectedChain('bsc'); }}
                className="text-[10px] text-[#0066FF]/60 hover:text-[#0066FF] font-mono block mx-auto"
              >
                USDT (BSC)
              </button>
              <button
                onClick={() => { setScanInput('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); setSelectedChain('solana'); }}
                className="text-[10px] text-[#0066FF]/60 hover:text-[#0066FF] font-mono block mx-auto"
              >
                USDC (Solana)
              </button>
            </div>
          </div>
        )}
    </div>
    </AuroraBackground>
  );
}
