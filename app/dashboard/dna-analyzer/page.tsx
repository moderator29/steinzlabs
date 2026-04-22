'use client';

import { useState, useEffect } from 'react';
import {
  Dna, Loader2, TrendingUp, Shield, Target, Brain, Zap,
  BarChart3, AlertTriangle, CheckCircle, RotateCcw, FileCode2, ArrowRight,
  Copy, Bell, Map, Search, Users, Activity, ThumbsUp, ThumbsDown, ExternalLink,
  Award, TrendingDown, Clock, Hash
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
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

interface RecentTx {
  hash: string;
  type: string;
  asset: string;
  amount: string;
  from: string;
  to: string;
  blockTime: string | null;
}

interface TrendingCoin {
  symbol: string;
  name: string;
  address: string;
  price: string;
  change24h: number;
  chain: string;
  imageUri?: string;
  dexUrl?: string;
}

interface CoinWorthWatching {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  holders?: number;
  logoURI?: string;
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
  recentTransactions: RecentTx[];
  coinsWorthWatching?: CoinWorthWatching[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('0x')) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Unknown';
  // Already formatted (e.g. "Jan 1, 2024") — return as-is
  if (/[A-Za-z]/.test(iso) && !iso.includes('T')) return iso;
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
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

// ─── Live Market Context ──────────────────────────────────────────────────────

function LiveMarketContext() {
  const [fearGreed, setFearGreed] = useState<{ value: number; label: string } | null>(null);
  const [trending, setTrending] = useState<Array<{ symbol: string; change: number }>>([]);

  useEffect(() => {
    // Fear & Greed index
    fetch('/api/market?type=fear-greed')
      .then(r => r.json())
      .then((d: { value?: number; label?: string }) => {
        if (d.value !== undefined) setFearGreed({ value: d.value, label: d.label ?? '' });
      })
      .catch(() => {});

    // Trending from CoinGecko (via internal proxy)
    fetch('/api/market?type=trending')
      .then(r => r.json())
      .then((d: { coins?: Array<{ symbol: string; change: number }> }) => {
        setTrending(d.coins ?? []);
      })
      .catch(() => {});
  }, []);

  const fgColor = fearGreed
    ? fearGreed.value >= 75 ? '#10B981'
    : fearGreed.value >= 55 ? '#22d3ee'
    : fearGreed.value >= 40 ? '#F59E0B'
    : fearGreed.value >= 25 ? '#F97316'
    : '#EF4444'
    : '#6B7280';

  return (
    <div className="glass rounded-xl p-4 border border-white/10 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#0A1EFF]" />
        <span className="font-bold text-sm">Live Market Context</span>
        <span className="ml-auto text-[9px] text-gray-600 uppercase tracking-wider">Real-time</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Fear & Greed */}
        <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col items-center gap-1 border border-white/[0.06]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Fear & Greed</div>
          {fearGreed ? (
            <>
              <div className="text-3xl font-black font-heading" style={{ color: fgColor }}>{fearGreed.value}</div>
              <div className="text-[10px] font-semibold" style={{ color: fgColor }}>{fearGreed.label}</div>
            </>
          ) : (
            <div className="text-2xl font-black text-gray-700 animate-pulse">--</div>
          )}
        </div>

        {/* Market Pulse */}
        <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1 border border-white/[0.06]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Market Pulse</div>
          {fearGreed ? (
            <div className="space-y-1">
              {[
                { label: 'Sentiment', val: fearGreed.value >= 50 ? 'Bullish' : 'Bearish', color: fearGreed.value >= 50 ? '#10B981' : '#EF4444' },
                { label: 'Signal', val: fearGreed.value >= 75 ? 'Caution (overbought)' : fearGreed.value <= 25 ? 'Opportunity' : 'Neutral', color: fgColor },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between text-[10px]">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-600 animate-pulse">Loading...</div>
          )}
        </div>
      </div>

      {/* Trending tokens */}
      {trending.length > 0 && (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Trending Now</div>
          <div className="flex flex-wrap gap-1.5">
            {trending.map((t, i) => {
              const isPos = t.change >= 0;
              return (
                <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border"
                  style={{ backgroundColor: `${isPos ? '#10B981' : '#EF4444'}10`, borderColor: `${isPos ? '#10B981' : '#EF4444'}25`, color: isPos ? '#10B981' : '#EF4444' }}>
                  {t.symbol}
                  <span className="text-[9px] opacity-70">{isPos ? '+' : ''}{t.change.toFixed(1)}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
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
  const [trendingCoins, setTrendingCoins] = useState<TrendingCoin[]>([]);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});
  const [copiedCA, setCopiedCA] = useState<string | null>(null);

  useEffect(() => {
    if (!dna) return;
    // Use coinsWorthWatching from DNA analysis API — pre-filtered, excludes held tokens.
    // Falls back to market trending only if the API returned nothing.
    if (dna.coinsWorthWatching && dna.coinsWorthWatching.length > 0) {
      setTrendingCoins(dna.coinsWorthWatching.map(c => ({
        symbol: c.symbol,
        name: c.name,
        address: c.address,
        price: String(c.price),
        change24h: c.priceChange24h,
        chain: dna.chain,
        imageUri: c.logoURI,
        dexUrl: undefined,
      })));
      return;
    }
    // Fallback: raw market trending (unfiltered)
    const chain = dna.chain.toLowerCase().includes('sol') ? 'solana' : 'ethereum';
    fetch(`/api/market?type=trending-tokens&chain=${chain}`)
      .then(r => r.json())
      .then((d: { tokens?: TrendingCoin[] }) => {
        setTrendingCoins(d.tokens ?? []);
      })
      .catch(() => {});
  }, [dna]);

  // ── contract check
  const checkIfContract = async (address: string): Promise<boolean> => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
    try {
      const res = await fetch(`/api/util/is-contract?address=${encodeURIComponent(address)}`);
      if (!res.ok) return false;
      const data = await res.json() as { isContract?: boolean };
      return data.isContract ?? false;
    } catch {
      return false;
    }
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
          <BackButton href="/dashboard" />
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
                Decode the complete DNA of any wallet — identity profile, trading patterns, partner wallets, and AI intelligence.
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
                  <p className="text-sm text-gray-400">Smart contracts don&apos;t have trading behavior or portfolio history. To audit a contract&apos;s security and risk factors, use our Token Scanner.</p>
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

            {/* ── Score + Grade Hero Cards ─────────────────────────────────── */}
            {dna.aiAnalysis && (
              <div className="grid grid-cols-2 gap-3">
                {/* Overall Score */}
                <div className="glass rounded-2xl border border-white/10 p-5 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 50% 80%, ${getScoreColor(dna.aiAnalysis.overallScore)}, transparent 70%)` }} />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Overall Score</div>
                  <div className="relative w-24 h-24 flex items-center justify-center mb-2">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={getScoreColor(dna.aiAnalysis.overallScore)}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - dna.aiAnalysis.overallScore / 100)}`}
                        style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${getScoreColor(dna.aiAnalysis.overallScore)})` }}
                      />
                    </svg>
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-heading font-black" style={{ color: getScoreColor(dna.aiAnalysis.overallScore) }}>
                        {dna.aiAnalysis.overallScore}
                      </span>
                      <span className="text-[9px] text-gray-500 font-semibold">/100</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold" style={{ color: getScoreColor(dna.aiAnalysis.overallScore) }}>
                    {dna.aiAnalysis.overallScore >= 80 ? 'Excellent' : dna.aiAnalysis.overallScore >= 60 ? 'Strong' : dna.aiAnalysis.overallScore >= 40 ? 'Moderate' : 'High Risk'}
                  </div>
                </div>

                {/* Portfolio Grade */}
                <div className="glass rounded-2xl border border-white/10 p-5 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 50% 80%, ${getGradeColor(dna.aiAnalysis.portfolioGrade)}, transparent 70%)` }} />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Portfolio Grade</div>
                  <div className="w-24 h-24 rounded-2xl flex items-center justify-center mb-2 border"
                    style={{ backgroundColor: `${getGradeColor(dna.aiAnalysis.portfolioGrade)}15`, borderColor: `${getGradeColor(dna.aiAnalysis.portfolioGrade)}35` }}>
                    <span className="text-5xl font-heading font-black" style={{ color: getGradeColor(dna.aiAnalysis.portfolioGrade), textShadow: `0 0 20px ${getGradeColor(dna.aiAnalysis.portfolioGrade)}80` }}>
                      {dna.aiAnalysis.portfolioGrade}
                    </span>
                  </div>
                  <div className="text-xs font-semibold" style={{ color: getGradeColor(dna.aiAnalysis.portfolioGrade) }}>
                    {dna.aiAnalysis.portfolioGrade?.startsWith('A') ? 'Top Tier' : dna.aiAnalysis.portfolioGrade?.startsWith('B') ? 'Above Avg' : dna.aiAnalysis.portfolioGrade?.startsWith('C') ? 'Average' : 'Below Avg'}
                  </div>
                </div>
              </div>
            )}

            {/* ── Live Market Context ──────────────────────────────────────── */}
            <LiveMarketContext />

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

            {/* ── Section 2: Trading DNA Profile ──────────────────────────── */}
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
                let archetype = { label: 'Analyst', icon: 'A', color: '#0A1EFF', desc: 'Methodical and data-driven trading approach' };
                if (style.includes('hodl') || style.includes('long') || (dna.aiAnalysis?.metrics?.conviction || 0) >= 80) {
                  archetype = { label: 'Diamond Hands', icon: 'D', color: '#7C3AED', desc: 'Long-term conviction holder, rarely sells under pressure' };
                } else if (style.includes('scalp') || style.includes('day') || (dna.txCount || 0) > 200) {
                  archetype = { label: 'Scalper', icon: 'S', color: '#F59E0B', desc: 'High-frequency short-term trader, fast in and out' };
                } else if (style.includes('whale') || style.includes('copy') || score < 40) {
                  archetype = { label: 'Whale Follower', icon: 'W', color: '#10B981', desc: 'Tracks and mirrors large wallet movements' };
                } else if (style.includes('degen') || (sector?.memecoins || 0) > 50) {
                  archetype = { label: 'Degen', icon: 'DG', color: '#EF4444', desc: 'High-risk memecoin and speculative plays' };
                } else if (style.includes('defi') || (sector?.defi || 0) > 40) {
                  archetype = { label: 'DeFi Native', icon: 'DF', color: '#10B981', desc: 'Protocol farmer and liquidity provider' };
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
                  <span className="font-bold text-sm">Naka Intelligence Analysis</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#7C3AED]/20 text-[#7C3AED] rounded-full font-bold border border-[#7C3AED]/30">AI</span>
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
                    <span className="font-bold text-sm">AI Recommendations</span>
                  </div>
                  <div className="space-y-2">
                    {dna.aiAnalysis.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-gray-300 py-2.5 border-b border-white/5 last:border-0">
                        <span className="w-5 h-5 bg-[#7C3AED]/20 rounded flex items-center justify-center text-[10px] font-bold text-[#7C3AED] flex-shrink-0 mt-0.5">{i + 1}</span>
                        <span className="flex-1">{r}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setFeedback(prev => ({ ...prev, [i]: prev[i] === 'up' ? undefined as any : 'up' }))}
                            className={`p-1 rounded transition-colors ${feedback[i] === 'up' ? 'text-[#10B981]' : 'text-gray-600 hover:text-gray-400'}`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setFeedback(prev => ({ ...prev, [i]: prev[i] === 'down' ? undefined as any : 'down' }))}
                            className={`p-1 rounded transition-colors ${feedback[i] === 'down' ? 'text-[#EF4444]' : 'text-gray-600 hover:text-gray-400'}`}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        </div>
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

                {/* recent transactions */}
                {dna.recentTransactions && dna.recentTransactions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-[#0A1EFF]" />
                      <span className="font-bold text-sm">Recent Transactions</span>
                      <span className="ml-auto text-[10px] text-gray-600">{dna.recentTransactions.length} shown</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                      {dna.recentTransactions.map((tx, i) => {
                        const isOut = tx.from?.toLowerCase() === dna.address.toLowerCase();
                        const timeStr = tx.blockTime ? new Date(tx.blockTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                        const typeColor = tx.type === 'erc20' || tx.type === 'transfer' ? '#0A1EFF' : tx.type === 'external' ? '#F59E0B' : '#6B7280';
                        return (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOut ? 'bg-[#EF4444]' : 'bg-[#10B981]'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-white">{isOut ? 'Sent' : 'Received'}</span>
                                <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>
                                  {tx.asset || 'SOL'}
                                </span>
                              </div>
                              <div className="text-[9px] text-gray-600 font-mono truncate">
                                {isOut ? `→ ${tx.to?.slice(0, 8)}...${tx.to?.slice(-4)}` : `← ${tx.from?.slice(0, 8)}...${tx.from?.slice(-4)}`}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-[11px] font-mono font-semibold text-white">{tx.amount !== '—' ? tx.amount : ''}</div>
                              <div className="text-[9px] text-gray-600">{timeStr}</div>
                            </div>
                            {tx.hash && (
                              <a
                                href={dna.chain === 'Solana' ? `https://solscan.io/tx/${tx.hash}` : `https://etherscan.io/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                              >
                                <Hash className="w-3 h-3 text-gray-600 hover:text-gray-400" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
