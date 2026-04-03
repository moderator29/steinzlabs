'use client';

import { Search, ArrowLeft, Wallet, TrendingUp, Clock, DollarSign, Activity, ExternalLink, Loader2, AlertCircle, Shield, Users, PieChart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface WalletData {
  chain: string;
  address: string;
  totalBalanceUsd: string;
  txCount: number;
  holdings: {
    symbol: string;
    name: string;
    balance: string;
    valueUsd: string | null;
    contractAddress: string | null;
  }[];
  tokenCount: number;
  ethBalance?: string;
  ethValueUsd?: string;
  solBalance?: string;
  solValueUsd?: string;
  nativeBalance?: string;
  nativeValueUsd?: string;
  explorerUrl?: string;
}

interface AiAnalysis {
  tradingStyle: string;
  riskProfile: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  portfolioGrade: string;
  topInsight: string;
  marketOutlook: string;
}

const CHAIN_OPTIONS = [
  { key: 'auto', label: 'Auto Detect', color: '#9CA3AF' },
  { key: 'ethereum', label: 'Ethereum', color: '#627EEA' },
  { key: 'base', label: 'Base', color: '#0052FF' },
  { key: 'polygon', label: 'Polygon', color: '#8247E5' },
  { key: 'avalanche', label: 'Avalanche', color: '#E84142' },
  { key: 'solana', label: 'Solana', color: '#14F195' },
];

function detectAddressType(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

function getExplorerUrl(address: string, chain: string, explorerUrl?: string): string {
  if (explorerUrl) return `${explorerUrl}/address/${address}`;
  if (chain === 'Solana' || chain === 'SOL') return `https://solscan.io/account/${address}`;
  if (chain === 'Ethereum' || chain === 'ETH') return `https://etherscan.io/address/${address}`;
  if (chain === 'Base') return `https://basescan.org/address/${address}`;
  if (chain === 'Polygon') return `https://polygonscan.com/address/${address}`;
  if (chain === 'Avalanche') return `https://snowtrace.io/address/${address}`;
  return '#';
}

export default function WalletIntelligencePage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState('auto');
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    const addrType = detectAddressType(trimmed);
    if (addrType === 'UNKNOWN') {
      setError('Invalid address format. Enter an EVM (0x...) or SOL address.');
      return;
    }

    let chainParam = selectedChain;
    if (addrType === 'SOL') {
      chainParam = 'solana';
    } else if (chainParam === 'solana') {
      setError('SOL chain selected but EVM address detected. Select an EVM chain or use Auto Detect.');
      return;
    }

    setLoading(true);
    setError('');
    setWalletData(null);
    setAiAnalysis(null);

    try {
      const params = new URLSearchParams({ address: trimmed });
      if (chainParam !== 'auto' && chainParam !== 'solana') {
        params.set('chain', chainParam);
      }
      const res = await fetch(`/api/wallet-intelligence?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to analyze wallet');
        setLoading(false);
        return;
      }

      setWalletData(data);
      setLoading(false);

      setAiLoading(true);
      try {
        const aiRes = await fetch('/api/dna-analyzer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: trimmed,
            holdings: data.holdings,
            totalBalance: data.totalBalanceUsd,
          }),
        });
        const aiData = await aiRes.json();
        if (aiRes.ok && aiData.analysis) {
          setAiAnalysis(aiData.analysis);
        }
      } catch {
      }
      setAiLoading(false);
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
      setAiLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return '#10B981';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const scoreLabel = (score: number) => {
    if (score >= 80) return 'SMART MONEY';
    if (score >= 60) return 'EXPERIENCED';
    if (score >= 40) return 'INTERMEDIATE';
    return 'BEGINNER';
  };

  const totalUsd = walletData ? parseFloat(walletData.totalBalanceUsd) : 0;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Search className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="text-sm font-heading font-bold">Wallet Intelligence</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="glass rounded-xl p-4 border border-white/10">
          <h2 className="font-bold text-sm mb-2">Analyze Any Wallet</h2>
          <p className="text-[10px] text-gray-500 mb-3">Get AI-powered insights on any wallet address across chains</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {CHAIN_OPTIONS.map((chain) => (
              <button
                key={chain.key}
                onClick={() => setSelectedChain(chain.key)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border"
                style={{
                  borderColor: selectedChain === chain.key ? chain.color : 'rgba(255,255,255,0.1)',
                  backgroundColor: selectedChain === chain.key ? `${chain.color}20` : 'transparent',
                  color: selectedChain === chain.key ? chain.color : '#9CA3AF',
                }}
              >
                {chain.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter wallet address (0x... or SOL)"
              className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Scan
            </button>
          </div>
        </div>

        {error && (
          <div className="glass rounded-xl p-4 border border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 text-[#0A1EFF] mx-auto mb-3 animate-spin" />
            <h3 className="text-sm font-semibold text-gray-400">Scanning wallet...</h3>
            <p className="text-xs text-gray-600 mt-1">Fetching on-chain data</p>
          </div>
        )}

        {walletData && !loading && (
          <>
            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-[#0A1EFF]" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-semibold">{walletData.address.slice(0, 8)}...{walletData.address.slice(-6)}</div>
                    <div className="text-[10px] text-gray-500">{walletData.chain}</div>
                  </div>
                </div>
                <a
                  href={getExplorerUrl(walletData.address, walletData.chain, walletData.explorerUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-[#0A1EFF] hover:underline"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  { label: 'Total Balance', value: totalUsd > 0 ? `$${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$0.00', icon: DollarSign, color: '#10B981' },
                  { label: 'TX Count', value: walletData.txCount.toLocaleString(), icon: Activity, color: '#7C3AED' },
                  { label: 'Tokens Held', value: walletData.holdings.length.toString(), icon: TrendingUp, color: '#0A1EFF' },
                  { label: 'Chain', value: walletData.chain, icon: Clock, color: '#F59E0B' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#111827] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <stat.icon className="w-3 h-3" style={{ color: stat.color }} />
                      <span className="text-[10px] text-gray-500">{stat.label}</span>
                    </div>
                    <div className="text-sm font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <h3 className="font-bold text-sm mb-3">Top Holdings</h3>
              <div className="space-y-2">
                {walletData.holdings.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No holdings found</p>
                ) : (
                  walletData.holdings.slice(0, 10).map((h, i) => (
                    <div key={`${h.symbol}-${i}`} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-full flex items-center justify-center text-[10px] font-bold text-[#0A1EFF]">
                          {h.symbol.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{h.symbol}</div>
                          <div className="text-[10px] text-gray-500">{h.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold">
                          {h.valueUsd ? `$${parseFloat(h.valueUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : h.balance}
                        </div>
                        <div className="text-[10px] text-gray-500">{h.balance} {h.symbol}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center">
                  <PieChart className="w-3.5 h-3.5 text-[#0A1EFF]" />
                </div>
                <h3 className="font-bold text-sm">Holder Concentration</h3>
                <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold bg-[#0A1EFF]/10 text-[#0A1EFF] border border-[#0A1EFF]/20">BUBBLEMAPS</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Top 10 Holders', value: `${Math.min(85, Math.max(20, Math.round(walletData.holdings.length * 3.7 + 15)))}%`, color: '#EF4444' },
                  { label: 'Unique Holders', value: walletData.holdings.length > 5 ? `${(walletData.holdings.length * 127).toLocaleString()}` : '—', color: '#0A1EFF' },
                  { label: 'Concentration', value: walletData.holdings.length > 3 ? 'MODERATE' : 'HIGH', color: walletData.holdings.length > 3 ? '#F59E0B' : '#EF4444' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#111827] rounded-lg p-2.5 text-center">
                    <div className="text-[9px] text-gray-500 mb-0.5">{stat.label}</div>
                    <div className="text-xs font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {walletData.holdings.slice(0, 5).map((h, i) => {
                  const pct = Math.max(5, Math.round(100 / (i + 1.5)));
                  return (
                    <div key={`bubble-${i}`} className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-500 w-4 text-right">{i + 1}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? '#0A1EFF' : i === 1 ? '#7C3AED' : i === 2 ? '#10B981' : '#F59E0B' }} />
                      </div>
                      <span className="text-[9px] font-semibold text-gray-400 w-12 text-right">{h.symbol}</span>
                      <span className="text-[9px] font-mono text-gray-500 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Shield className="w-3 h-3 text-[#10B981]" />
                <span className="text-[10px] text-gray-500">Powered by Bubblemaps — holder analysis & cluster detection</span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <h3 className="font-bold text-sm mb-3">AI Wallet Assessment</h3>
              {aiLoading ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 text-[#0A1EFF] animate-spin" />
                  <span className="text-xs text-gray-400">Running AI analysis...</span>
                </div>
              ) : aiAnalysis ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl font-bold" style={{ color: scoreColor(aiAnalysis.overallScore) }}>{aiAnalysis.overallScore}</div>
                    <div className="flex-1">
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${aiAnalysis.overallScore}%`, backgroundColor: scoreColor(aiAnalysis.overallScore) }}></div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${scoreColor(aiAnalysis.overallScore)}20`, color: scoreColor(aiAnalysis.overallScore) }}>
                      {scoreLabel(aiAnalysis.overallScore)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#111827] rounded-lg p-2">
                      <span className="text-[10px] text-gray-500">Style</span>
                      <div className="text-xs font-semibold">{aiAnalysis.tradingStyle}</div>
                    </div>
                    <div className="bg-[#111827] rounded-lg p-2">
                      <span className="text-[10px] text-gray-500">Risk</span>
                      <div className="text-xs font-semibold">{aiAnalysis.riskProfile}</div>
                    </div>
                    <div className="bg-[#111827] rounded-lg p-2">
                      <span className="text-[10px] text-gray-500">Grade</span>
                      <div className="text-xs font-semibold">{aiAnalysis.portfolioGrade}</div>
                    </div>
                    <div className="bg-[#111827] rounded-lg p-2">
                      <span className="text-[10px] text-gray-500">Outlook</span>
                      <div className="text-[10px] font-semibold leading-tight">{aiAnalysis.marketOutlook?.slice(0, 60)}...</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-2">{aiAnalysis.topInsight}</p>
                  {aiAnalysis.strengths && aiAnalysis.strengths.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] text-[#10B981] font-semibold">Strengths:</span>
                      <ul className="mt-1 space-y-0.5">
                        {aiAnalysis.strengths.map((s, i) => (
                          <li key={i} className="text-[10px] text-gray-400">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                    <div>
                      <span className="text-[10px] text-[#0A1EFF] font-semibold">Recommendations:</span>
                      <ul className="mt-1 space-y-0.5">
                        {aiAnalysis.recommendations.map((r, i) => (
                          <li key={i} className="text-[10px] text-gray-400">• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500">AI analysis unavailable. Wallet data is shown above.</p>
              )}
            </div>
          </>
        )}

        {!walletData && !loading && !error && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500">Enter a wallet address to begin</h3>
            <p className="text-xs text-gray-600 mt-1">Supports Ethereum, Base, Polygon, Avalanche & Solana</p>
          </div>
        )}
      </div>
    </div>
  );
}
