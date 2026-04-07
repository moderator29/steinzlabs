'use client';

import { useState } from 'react';
import {
  Dna, ArrowLeft, Loader2, TrendingUp, Shield, Target, Brain, Zap,
  BarChart3, AlertTriangle, CheckCircle, RotateCcw, FileCode2, ArrowRight,
  Copy, Bell, Map, Search, Users, Activity
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenHolding {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress: string | null;
  change24h?: number;
}

interface PartnerWallet {
  address: string;
  txCount: number;
  volume: string;
  label: string;
}

interface SectorBreakdown {
  memecoins: number;
  defi: number;
  stablecoins: number;
  layer1layer2: number;
}

interface AIAnalysis {
  personalityProfile: string;
  tradingStyle: string;
  riskProfile: string;
  overallScore: number;
  portfolioGrade: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  personalityTraits: string[];
  marketOutlook: string;
  topInsight: string;
  sectorBreakdown: SectorBreakdown;
  riskClassification: string;
  metrics: {
    diversification: number;
    timing: number;
    riskManagement: number;
    consistency: number;
    conviction: number;
  };
}

interface DNAData {
  address: string;
  chain: string;
  holdings: TokenHolding[];
  totalBalanceUsd: number;
  txCount: number;
  firstSeen: string | null;
  lastActive: string | null;
  totalVolume: number;
  tradingStyle: string;
  favoriteTokens: string[];
  partnerWallets: PartnerWallet[];
  riskClassification: string;
  aiAnalysis: AIAnalysis | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('0x')) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function fmtUsd(val: number | string | null): string {
  const n = parseFloat(String(val || '0'));
  if (isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const RISK_BADGE_COLORS: Record<string, string> = {
  DEGEN: 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30',
  BALANCED: 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30',
  CONSERVATIVE: 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/30',
  WHALE: 'bg-[#7C3AED]/20 text-[#7C3AED] border-[#7C3AED]/30',
  'SMART MONEY': 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30',
};

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#0A1EFF';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function getGradeColor(grade: string): string {
  if (grade?.startsWith('A')) return '#10B981';
  if (grade?.startsWith('B')) return '#0A1EFF';
  if (grade?.startsWith('C')) return '#F59E0B';
  return '#EF4444';
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className={`p-1 hover:bg-white/10 rounded transition-colors ${className}`} title="Copy">
      {copied
        ? <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
        : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

// ─── Portfolio Bubble Map ─────────────────────────────────────────────────────

function PortfolioBubbleMap({ holdings }: { holdings: TokenHolding[] }) {
  const [selectedToken, setSelectedToken] = useState<any | null>(null);

  const filtered = holdings
    .map((h) => ({ ...h, usdVal: parseFloat(h.valueUsd || '0') }))
    .filter((h) => h.usdVal > 0 || parseFloat(h.balance) > 0)
    .sort((a, b) => b.usdVal - a.usdVal)
    .slice(0, 20);

  if (filtered.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-8">
        No token holdings with value detected.
      </div>
    );
  }

  const maxVal = Math.max(...filtered.map((t) => t.usdVal), 1);

  return (
    <div>
      {/* Bubble grid */}
      <div className="flex flex-wrap items-center justify-center gap-2 py-4 min-h-[160px]">
        {filtered.map((token) => {
          const size = Math.max(44, Math.min(140, (token.usdVal / maxVal) * 140));
          const isSelected = selectedToken?.contractAddress === token.contractAddress
            && selectedToken?.symbol === token.symbol;
          const change = token.change24h ?? 0;
          const bg = change > 0 ? '#22c55e' : change < 0 ? '#ef4444' : '#6b7280';
          return (
            <div
              key={`${token.symbol}-${token.contractAddress}`}
              onClick={() => setSelectedToken(isSelected ? null : token)}
              style={{
                width: size,
                height: size,
                backgroundColor: bg,
                borderRadius: '50%',
                opacity: isSelected ? 1 : 0.82,
                boxShadow: isSelected ? `0 0 0 3px white, 0 0 16px ${bg}` : 'none',
                flexShrink: 0,
              }}
              className="flex items-center justify-center cursor-pointer hover:opacity-100 transition-all m-1"
            >
              <span
                className="font-bold text-white text-center leading-tight px-1 select-none"
                style={{ fontSize: Math.max(9, Math.min(14, size * 0.22)) }}
              >
                {token.symbol}
              </span>
            </div>
          );
        })}
      </div>

      {/* Token detail card */}
      {selectedToken && (
        <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1.5 text-xs animate-fadeInUp">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm">{selectedToken.symbol}</span>
            <span className="text-gray-400">{selectedToken.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Amount Held</span>
            <span className="text-white font-semibold">{parseFloat(selectedToken.balance).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">USD Value</span>
            <span className="text-white font-semibold">{fmtUsd(selectedToken.valueUsd)}</span>
          </div>
          {selectedToken.contractAddress && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Contract</span>
              <div className="flex items-center gap-1">
                <span className="text-white font-mono">{shortAddr(selectedToken.contractAddress)}</span>
                <CopyButton text={selectedToken.contractAddress} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-400">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /><span>Positive 24h</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /><span>Negative 24h</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" /><span>Neutral</span></div>
        <div className="flex items-center gap-1 ml-auto"><span className="italic">Bubble size = USD value</span></div>
      </div>
    </div>
  );
}

// ─── Sector Pie (simple CSS) ──────────────────────────────────────────────────

function SectorPie({ breakdown }: { breakdown: SectorBreakdown }) {
  const sectors = [
    { label: 'Memecoins', value: breakdown.memecoins, color: '#ef4444' },
    { label: 'DeFi', value: breakdown.defi, color: '#7C3AED' },
    { label: 'Stablecoins', value: breakdown.stablecoins, color: '#10B981' },
    { label: 'L1/L2', value: breakdown.layer1layer2, color: '#0A1EFF' },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-2">
      {sectors.map((s) => (
        <div key={s.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-white">{s.value}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DNAAnalyzerPage() {
  const router = useRouter();
  const { address: walletAddress, connectAuto } = useWallet();

  const [inputAddress, setInputAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dna, setDna] = useState<DNAData | null>(null);
  const [isContractAddress, setIsContractAddress] = useState(false);
  const [contractAddress, setContractAddress] = useState('');

  // ── contract check
  const checkIfContract = async (address: string): Promise<boolean> => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
    try {
      const rpcUrls = ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'];
      for (const rpcUrl of rpcUrls) {
        try {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getCode', params: [address, 'latest'], id: 1 }),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.result && data.result !== '0x' && data.result !== '0x0') return true;
            return false;
          }
        } catch { continue; }
      }
    } catch {}
    return false;
  };

  // ── main analysis runner
  const runAnalysis = async (address: string) => {
    const addr = address.trim();
    if (!addr) return;

    setLoading(true);
    setError('');
    setDna(null);
    setIsContractAddress(false);
    setContractAddress('');

    try {
      const isContract = await checkIfContract(addr);
      if (isContract) {
        setIsContractAddress(true);
        setContractAddress(addr);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/dna-analysis?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setDna(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze wallet');
    } finally {
      setLoading(false);
    }
  };

  const connectAndAnalyze = async () => {
    try {
      const addr = await connectAuto();
      if (addr) runAnalysis(addr);
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  };

  const reset = () => {
    setDna(null);
    setIsContractAddress(false);
    setContractAddress('');
    setInputAddress('');
    setError('');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-12">
      {/* Header */}
      <div className="fixed top-0 w-full z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center px-4 h-14 gap-3">
          <button onClick={() => router.push('/dashboard')} className="hover:bg-white/10 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Dna className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="font-heading font-bold">DNA Analyzer</h1>
          <span className="ml-auto text-[10px] px-2 py-1 bg-[#7C3AED]/20 text-[#7C3AED] rounded-full font-semibold">AI Powered</span>
        </div>
      </div>

      <div className="pt-20 px-4 max-w-2xl mx-auto">

        {/* ── Input state ─────────────────────────────────────────────────── */}
        {!dna && !loading && !isContractAddress && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Dna className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">Deep Network Analysis</h2>
              <p className="text-gray-400 text-sm">
                Decode the complete DNA of any wallet — identity profile, portfolio bubbles, trading patterns, partner wallets, and AI intelligence.
              </p>
            </div>

            {walletAddress && (
              <div className="space-y-3">
                <div className="glass rounded-xl p-4 border border-white/10 overflow-hidden">
                  <div className="text-[10px] text-gray-500 mb-1">Connected Wallet</div>
                  <div className="text-sm font-mono text-gray-300 truncate">{walletAddress}</div>
                </div>
                <button
                  onClick={() => runAnalysis(walletAddress)}
                  className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                >
                  <Brain className="w-5 h-5" /> Analyze My DNA
                </button>
              </div>
            )}

            {!walletAddress && (
              <button
                onClick={connectAndAnalyze}
                className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                Connect Wallet & Analyze
              </button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center"><span className="px-4 bg-[#0A0E1A] text-xs text-gray-500">or analyze any wallet</span></div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runAnalysis(inputAddress)}
                placeholder="Enter wallet address (0x... or Solana)"
                className="flex-1 min-w-0 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#0A1EFF]/50"
              />
              <button
                onClick={() => runAnalysis(inputAddress)}
                disabled={!inputAddress.trim()}
                className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 font-semibold text-sm whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                Analyze DNA
              </button>
            </div>

            {error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-[#EF4444] text-sm">{error}</div>
            )}
          </div>
        )}

        {/* ── Contract address warning ────────────────────────────────────── */}
        {isContractAddress && (
          <div className="space-y-6 animate-fadeInUp">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#F59E0B]/30">
                <FileCode2 className="w-10 h-10 text-[#F59E0B]" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2 text-[#F59E0B]">Smart Contract Detected</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                This is a smart contract, not a wallet. The DNA Analyzer works on <span className="text-white font-semibold">wallet addresses only</span>.
              </p>
            </div>
            <div className="glass rounded-xl p-4 border border-[#F59E0B]/20 bg-[#F59E0B]/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm mb-1 text-[#F59E0B]">Use Token Scanner instead</div>
                  <p className="text-sm text-gray-400">Smart contracts don't have trading behavior or portfolio history. To audit a contract's security and risk factors, use our Token Scanner.</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-[10px] text-gray-500 mb-1">Detected Address</div>
              <div className="text-sm font-mono text-gray-300 break-all">{contractAddress}</div>
              <div className="mt-2 inline-block px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] rounded text-[10px] font-semibold uppercase tracking-wider">Smart Contract</div>
            </div>
            <button
              onClick={() => router.push('/dashboard/security')}
              className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <Shield className="w-5 h-5" /> Go to Token Scanner <ArrowRight className="w-4 h-4 ml-1" />
            </button>
            <button
              onClick={reset}
              className="w-full border border-white/10 py-3 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Enter a Wallet Address
            </button>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-[#0A1EFF] animate-spin" />
            </div>
            <h3 className="text-xl font-heading font-bold mb-2">Decoding DNA...</h3>
            <p className="text-gray-400 text-sm">Scanning on-chain history, portfolio, and trading patterns</p>
            <div className="mt-6 max-w-xs mx-auto space-y-2">
              {['Fetching token balances', 'Parsing transaction history', 'Identifying partner wallets', 'Running AI intelligence analysis'].map((step, i) => (
                <div key={step} className="flex items-center gap-2 text-xs text-gray-400 animate-fadeInUp" style={{ animationDelay: `${i * 0.4}s` }}>
                  <Loader2 className="w-3 h-3 animate-spin text-[#0A1EFF]" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DNA Results ─────────────────────────────────────────────────── */}
        {dna && !loading && (
          <div className="space-y-5 animate-fadeInUp">

            {/* Top bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Wallet DNA</h2>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> New Analysis
              </button>
            </div>

            {/* ── Section 1: Identity Profile ─────────────────────────────── */}
            <div className="glass rounded-xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-[#0A1EFF]" />
                <span className="font-bold text-sm">Identity Profile</span>
                {dna.riskClassification && (
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${RISK_BADGE_COLORS[dna.riskClassification] || 'bg-white/10 text-white border-white/20'}`}>
                    {dna.riskClassification}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-300">{shortAddr(dna.address)}</span>
                <CopyButton text={dna.address} />
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#0A1EFF]/20 text-[#0A1EFF] font-semibold">{dna.chain}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-0.5">First Seen</div>
                  <div className="text-sm font-semibold">{fmtDate(dna.firstSeen)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-0.5">Last Active</div>
                  <div className="text-sm font-semibold">{fmtDate(dna.lastActive)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-0.5">Total Transactions</div>
                  <div className="text-sm font-semibold">{dna.txCount.toLocaleString()}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-0.5">Portfolio Value</div>
                  <div className="text-sm font-semibold">{fmtUsd(dna.totalBalanceUsd)}</div>
                </div>
              </div>
            </div>

            {/* ── Section 2: Portfolio Holdings Bubble Map ─────────────────── */}
            <div className="glass rounded-xl p-5 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Map className="w-4 h-4 text-[#0A1EFF]" />
                <span className="font-bold text-sm">Portfolio Holdings Bubble Map</span>
              </div>
              {dna.holdings && dna.holdings.length > 0
                ? <PortfolioBubbleMap holdings={dna.holdings} />
                : <div className="text-center text-gray-500 text-sm py-8">No holdings found for this wallet.</div>
              }
            </div>

            {/* ── Section 3: Trading DNA Profile ──────────────────────────── */}
            <div className="glass rounded-xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-[#7C3AED]" />
                <span className="font-bold text-sm">Trading DNA Profile</span>
              </div>

              {/* Behavioral Archetype */}
              {(() => {
                const style = (dna.aiAnalysis?.tradingStyle || dna.tradingStyle || '').toLowerCase();
                const score = dna.aiAnalysis?.overallScore || 0;
                const sector = dna.aiAnalysis?.sectorBreakdown;
                let archetype = { label: 'Analyst', icon: '🔬', color: '#0A1EFF', desc: 'Methodical and data-driven trading approach' };
                if (style.includes('hodl') || style.includes('long') || (dna.aiAnalysis?.metrics?.conviction || 0) >= 80) {
                  archetype = { label: 'Diamond Hands', icon: '💎', color: '#7C3AED', desc: 'Long-term conviction holder, rarely sells under pressure' };
                } else if (style.includes('scalp') || style.includes('day') || (dna.txCount || 0) > 200) {
                  archetype = { label: 'Scalper', icon: '⚡', color: '#F59E0B', desc: 'High-frequency short-term trader, fast in and out' };
                } else if (style.includes('whale') || style.includes('copy') || score < 40) {
                  archetype = { label: 'Whale Follower', icon: '🐋', color: '#10B981', desc: 'Tracks and mirrors large wallet movements' };
                } else if (style.includes('degen') || (sector?.memecoins || 0) > 50) {
                  archetype = { label: 'Degen', icon: '🔥', color: '#EF4444', desc: 'High-risk memecoin and speculative plays' };
                } else if (style.includes('defi') || (sector?.defi || 0) > 40) {
                  archetype = { label: 'DeFi Native', icon: '⚙️', color: '#10B981', desc: 'Protocol farmer and liquidity provider' };
                }
                return (
                  <div className="flex items-center gap-3 p-3 rounded-xl border mb-2" style={{ backgroundColor: `${archetype.color}08`, borderColor: `${archetype.color}25` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ backgroundColor: `${archetype.color}20` }}>
                      {archetype.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider">Behavioral Archetype</div>
                      <div className="text-base font-bold" style={{ color: archetype.color }}>{archetype.label}</div>
                      <div className="text-[10px] text-gray-500">{archetype.desc}</div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-0.5">Primary Chain</div>
                  <div className="text-sm font-semibold">{dna.chain}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-0.5">Trading Style</div>
                  <div className="text-sm font-semibold">{dna.aiAnalysis?.tradingStyle || dna.tradingStyle}</div>
                </div>
                {dna.aiAnalysis?.metrics && (
                  <>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 mb-0.5">Win Rate</div>
                      <div className="text-sm font-semibold">
                        {dna.aiAnalysis.metrics.timing ? `~${dna.aiAnalysis.metrics.timing}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 mb-0.5">Overall Score</div>
                      <div className="text-sm font-semibold" style={{ color: getScoreColor(dna.aiAnalysis.overallScore) }}>
                        {dna.aiAnalysis.overallScore}/100
                      </div>
                    </div>
                  </>
                )}
              </div>

              {dna.favoriteTokens && dna.favoriteTokens.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-2">Favorite Tokens (most traded)</div>
                  <div className="flex flex-wrap gap-2">
                    {dna.favoriteTokens.map((t, i) => (
                      <span key={i} className="px-2 py-1 bg-[#0A1EFF]/10 text-[#0A1EFF] rounded text-xs font-semibold border border-[#0A1EFF]/20">
                        #{i + 1} {t.length > 20 ? t.slice(0, 6) + '...' : t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics bars */}
              {dna.aiAnalysis?.metrics && (
                <div className="space-y-2.5">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Performance Metrics</div>
                  {Object.entries(dna.aiAnalysis.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-semibold" style={{ color: getScoreColor(value) }}>{value}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: getScoreColor(value) }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sector breakdown */}
              {dna.aiAnalysis?.sectorBreakdown && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Sector Breakdown</div>
                  <SectorPie breakdown={dna.aiAnalysis.sectorBreakdown} />
                </div>
              )}
            </div>

            {/* ── Section 4: Partner Wallets ───────────────────────────────── */}
            {dna.partnerWallets && dna.partnerWallets.length > 0 && (
              <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-[#10B981]" />
                  <span className="font-bold text-sm">Partner Wallets</span>
                  <span className="text-[10px] text-gray-500 ml-1">Most frequent counterparties</span>
                </div>
                {dna.partnerWallets.slice(0, 5).map((pw, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-7 h-7 bg-[#10B981]/10 rounded-full flex items-center justify-center text-xs font-bold text-[#10B981] flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-white">{shortAddr(pw.address)}</span>
                        <CopyButton text={pw.address} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-400">{pw.txCount} txs</span>
                        {parseFloat(pw.volume) > 0 && (
                          <span className="text-[10px] text-gray-400">{parseFloat(pw.volume).toFixed(4)} ETH</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-gray-400">{pw.label}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setInputAddress(pw.address);
                        setDna(null);
                        runAnalysis(pw.address);
                      }}
                      className="text-[10px] px-2 py-1 bg-[#0A1EFF]/20 text-[#0A1EFF] rounded border border-[#0A1EFF]/30 hover:bg-[#0A1EFF]/30 transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <Search className="w-3 h-3" /> Analyze
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Section 5: AI Intelligence Analysis ─────────────────────── */}
            {dna.aiAnalysis && (
              <div className="glass rounded-xl p-5 border border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED]/5 to-transparent space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-4 h-4 text-[#7C3AED]" />
                  <span className="font-bold text-sm">Steinz &#123;Sargon&#125; Intelligence Analysis</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-4xl font-heading font-bold" style={{ color: getScoreColor(dna.aiAnalysis.overallScore) }}>
                      {dna.aiAnalysis.overallScore}
                    </span>
                    <span className="text-3xl font-heading font-bold" style={{ color: getGradeColor(dna.aiAnalysis.portfolioGrade) }}>
                      {dna.aiAnalysis.portfolioGrade}
                    </span>
                  </div>
                </div>

                {/* personality profile */}
                {dna.aiAnalysis.personalityProfile && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Personality Profile</div>
                    <p className="text-sm text-gray-200 leading-relaxed">{dna.aiAnalysis.personalityProfile}</p>
                  </div>
                )}

                {/* traits */}
                {dna.aiAnalysis.personalityTraits && dna.aiAnalysis.personalityTraits.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {dna.aiAnalysis.personalityTraits.map((trait, i) => (
                      <span key={i} className="px-2 py-1 bg-[#7C3AED]/10 text-[#7C3AED] rounded text-xs border border-[#7C3AED]/20">{trait}</span>
                    ))}
                  </div>
                )}

                {/* key insight */}
                {dna.aiAnalysis.topInsight && (
                  <div className="bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-lg p-3 flex items-start gap-2">
                    <Target className="w-4 h-4 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-200">{dna.aiAnalysis.topInsight}</p>
                  </div>
                )}

                {/* strengths / weaknesses */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                      <span className="text-xs font-bold text-[#10B981]">Strengths</span>
                    </div>
                    <div className="space-y-1.5">
                      {dna.aiAnalysis.strengths.map((s, i) => (
                        <div key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                          <span className="text-[#10B981] mt-0.5 flex-shrink-0">+</span>{s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span className="text-xs font-bold text-[#F59E0B]">Weaknesses</span>
                    </div>
                    <div className="space-y-1.5">
                      {dna.aiAnalysis.weaknesses.map((w, i) => (
                        <div key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                          <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">!</span>{w}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* recommendations */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-[#7C3AED]" />
                    <span className="font-bold text-sm">Recommendations</span>
                  </div>
                  <div className="space-y-2">
                    {dna.aiAnalysis.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-gray-300 py-2 border-b border-white/5 last:border-0">
                        <span className="w-5 h-5 bg-[#7C3AED]/20 rounded flex items-center justify-center text-[10px] font-bold text-[#7C3AED] flex-shrink-0 mt-0.5">{i + 1}</span>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>

                {/* market outlook */}
                {dna.aiAnalysis.marketOutlook && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Market Outlook</div>
                    <p className="text-sm text-gray-300">{dna.aiAnalysis.marketOutlook}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Section 6: Quick Actions ─────────────────────────────────── */}
            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-[#F59E0B]" />
                <span className="font-bold text-sm">Quick Actions</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(dna.address).catch(() => {})}
                  className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-3 px-3 text-sm hover:bg-white/10 transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold">Copy Address</span>
                </button>

                <button
                  onClick={() => router.push(`/dashboard/alerts?wallet=${encodeURIComponent(dna.address)}`)}
                  className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-3 px-3 text-sm hover:bg-white/10 transition-colors"
                >
                  <Bell className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold">Track in Alerts</span>
                </button>

                <button
                  onClick={() => router.push(`/dashboard/bubble-map?ca=${encodeURIComponent(dna.address)}`)}
                  className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-3 px-3 text-sm hover:bg-white/10 transition-colors"
                >
                  <Map className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold">View Bubble Map</span>
                </button>

                <button
                  onClick={reset}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-lg py-3 px-3 text-sm hover:opacity-90 transition-opacity"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-xs font-bold">Analyze Another</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
