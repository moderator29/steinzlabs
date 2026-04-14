'use client';

import { Search, ArrowLeft, Wallet, TrendingUp, Clock, DollarSign, Activity, ExternalLink, Loader2, AlertCircle, Shield, PieChart, FileCode, ArrowRight, Copy, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Send, ArrowDownLeft, RefreshCw, Zap, Brain } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type TabMode = 'wallet' | 'contract';

interface RecentTx {
  hash: string;
  blockTime: string | null;
  status: 'success' | 'failed';
  type?: string;
  asset?: string;
  value?: number;
  from?: string;
  to?: string;
  memo?: string;
}

interface WalletData {
  chain: string;
  address: string;
  totalBalanceUsd: string;
  txCount: number;
  firstSeen?: string | null;
  lastActive?: string | null;
  holdings: {
    symbol: string;
    name: string;
    balance: string;
    valueUsd: string | null;
    contractAddress: string | null;
    logoUrl?: string | null;
  }[];
  tokenCount: number;
  ethBalance?: string;
  ethValueUsd?: string;
  solBalance?: string;
  solValueUsd?: string;
  nativeBalance?: string;
  nativeValueUsd?: string;
  explorerUrl?: string;
  recentTransactions?: RecentTx[];
}

// ─── Recent Transactions ───────────────────────────────────────────────────────
function RecentTransactions({ transactions, chain, walletAddress }: { transactions: RecentTx[]; chain: string; walletAddress: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? transactions : transactions.slice(0, 15);
  const explorerBase = chain === 'Solana' ? 'https://solscan.io/tx/' : 'https://etherscan.io/tx/';

  function formatTime(blockTime: string | null) {
    if (!blockTime) return '—';
    const d = new Date(blockTime);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function txIcon(type: string | undefined) {
    if (type === 'send') return <Send className="w-3 h-3 text-[#EF4444]" />;
    if (type === 'receive') return <ArrowDownLeft className="w-3 h-3 text-[#10B981]" />;
    return <RefreshCw className="w-3 h-3 text-[#0A1EFF]" />;
  }

  function txColor(type: string | undefined) {
    if (type === 'send') return '#EF4444';
    if (type === 'receive') return '#10B981';
    return '#0A1EFF';
  }

  return (
    <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#7C3AED]" />
          <h3 className="font-bold text-sm">Recent Transactions</h3>
          <span className="text-[10px] text-gray-500">(last {transactions.length})</span>
        </div>
      </div>
      {transactions.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">No recent transactions found</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {shown.map((tx, i) => (
              <div key={tx.hash + i} className="flex items-center gap-2 py-2 border-b border-[#1a1f2e]/50 last:border-0">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${txColor(tx.type)}15` }}>
                  {txIcon(tx.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold capitalize" style={{ color: txColor(tx.type) }}>
                      {tx.type || 'tx'}
                    </span>
                    {tx.asset && <span className="text-[10px] text-gray-400">{tx.asset}</span>}
                    {tx.value != null && tx.value > 0 && (
                      <span className="text-[10px] font-mono text-gray-300">
                        {tx.value < 0.001 ? tx.value.toFixed(6) : tx.value.toFixed(4)}
                      </span>
                    )}
                    {tx.memo && <span className="text-[9px] text-gray-600 italic truncate">{tx.memo.slice(0, 20)}</span>}
                  </div>
                  <div className="text-[9px] font-mono text-gray-600">{tx.hash.slice(0, 12)}...{tx.hash.slice(-6)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[9px] text-gray-500">{formatTime(tx.blockTime)}</div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className={`text-[9px] font-semibold ${tx.status === 'failed' ? 'text-red-400' : 'text-green-400'}`}>
                      {tx.status === 'failed' ? '✗' : '✓'}
                    </span>
                    <a href={`${explorerBase}${tx.hash}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-2.5 h-2.5 text-gray-600 hover:text-[#0A1EFF]" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {transactions.length > 15 && (
            <button onClick={() => setExpanded(e => !e)}
              className="w-full mt-2 py-2 text-[10px] text-[#0A1EFF] hover:bg-[#0A1EFF]/5 rounded-lg transition-colors flex items-center justify-center gap-1">
              {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {transactions.length} transactions</>}
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface AiAnalysis {
  tradingStyle: string;
  riskProfile: string;
  overallScore: number;
  portfolioGrade: string;
  topInsight: string;
  marketOutlook: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  personalityTraits?: string[];
  metrics?: {
    diversification: number;
    timing: number;
    riskManagement: number;
    consistency: number;
    conviction: number;
  };
  riskAssessment?: {
    riskLevel: string;
    riskScore: number;
    summary: string;
    keyRisks: string[];
  };
  activityPattern?: {
    classification: string;
    summary: string;
    estimatedFrequency: string;
    primaryChains: string[];
  };
  notableBehaviors?: Array<{ behavior: string; detail: string }>;
}

interface ContractResult {
  contract: string;
  chainId: string;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  creatorAddress: string;
  ownerAddress: string;
  trustScore: number;
  safetyLevel: string;
  safetyColor: string;
  buyTax: string;
  sellTax: string;
  isHoneypot: boolean;
  isOpenSource: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasHiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  ownerCanChangeBalance: boolean;
  lpHolders: any[];
  lpTotalSupply: string;
  checks: { label: string; status: string }[];
  timestamp: string;
  dexData?: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
    fdv: number;
    marketCap: number;
    dexId?: string;
    pairAddress?: string;
    url?: string;
    image?: string;
    socials?: any[];
    websites?: any[];
  };
  solanaNote?: string;
}

const CHAIN_OPTIONS = [
  { key: 'auto', label: 'Auto Detect', color: '#9CA3AF' },
  { key: 'ethereum', label: 'Ethereum', color: '#627EEA' },
  { key: 'base', label: 'Base', color: '#0052FF' },
  { key: 'polygon', label: 'Polygon', color: '#8247E5' },
  { key: 'avalanche', label: 'Avalanche', color: '#E84142' },
  { key: 'solana', label: 'Solana', color: '#14F195' },
];

const CONTRACT_CHAINS = [
  { id: '1', label: 'Ethereum', key: 'ethereum', color: '#627EEA' },
  { id: '56', label: 'BSC', key: 'bsc', color: '#F0B90B' },
  { id: '137', label: 'Polygon', key: 'polygon', color: '#8247E5' },
  { id: 'solana', label: 'Solana', key: 'solana', color: '#14F195' },
  { id: '8453', label: 'Base', key: 'base', color: '#0052FF' },
  { id: '43114', label: 'Avalanche', key: 'avalanche', color: '#E84142' },
  { id: '42161', label: 'Arbitrum', key: 'arbitrum', color: '#28A0F0' },
];

function detectAddressType(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

async function checkIfContract(address: string, addrType: 'EVM' | 'SOL' | 'UNKNOWN'): Promise<boolean> {
  try {
    if (addrType === 'EVM') {
      const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
      const rpcUrl = alchemyKey
        ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
        : 'https://eth.llamarpc.com';
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] }),
      });
      const data = await res.json();
      return data.result && data.result !== '0x' && data.result.length > 2;
    }
    return false;
  } catch {
    return false;
  }
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
  const [activeTab, setActiveTab] = useState<TabMode>('wallet');
  const [address, setAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState('auto');
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [contractInput, setContractInput] = useState('');
  const [contractChain, setContractChain] = useState('ethereum');
  const [contractResult, setContractResult] = useState<ContractResult | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState('');
  const [copied, setCopied] = useState('');

  const handleWalletSearch = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    const addrType = detectAddressType(trimmed);
    if (addrType === 'UNKNOWN') {
      setError('Invalid address format. Enter an EVM (0x...) or Solana wallet address.');
      return;
    }

    const isLikelyContract = await checkIfContract(trimmed, addrType);
    if (isLikelyContract) {
      setError('This looks like a token contract address, not a wallet. Switch to the Contract tab to scan contracts.');
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
            txCount: data.txCount,
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

  const handleContractScan = async () => {
    const ca = contractInput.trim();
    if (!ca) return;

    setContractLoading(true);
    setContractError('');
    setContractResult(null);

    try {
      const res = await fetch('/api/token-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract: ca, chain: contractChain }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.isWalletAddress) {
          setContractError(`${data.error}. ${data.message || 'Switch to the Wallet tab to analyze wallets.'}`);
        } else {
          setContractError(data.error || 'Failed to scan contract');
        }
        setContractLoading(false);
        return;
      }

      setContractResult(data);
    } catch (err: any) {
      setContractError(err.message || 'Network error');
    }
    setContractLoading(false);
  };

  const copyAddr = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
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

  // Wallet Type Classification
  function classifyWallet(data: WalletData | null, analysis: AiAnalysis | null): { type: string; color: string; desc: string } {
    if (!data) return { type: 'Unknown', color: '#6B7280', desc: 'No data' };
    const usd = parseFloat(data.totalBalanceUsd);
    const txCount = data.txCount;
    const tradingStyle = analysis?.tradingStyle?.toLowerCase() || '';

    // Bot/MEV detection (high tx count, small balance)
    if (txCount > 500 && usd < 50000) return { type: 'Bot / MEV', color: '#EF4444', desc: 'High-frequency automated activity detected' };
    // Dormant (very few txns)
    if (txCount < 3) return { type: 'Dormant', color: '#6B7280', desc: 'Low activity wallet, possibly inactive' };
    // Institutional (very large balance)
    if (usd > 10000000) return { type: 'Institutional', color: '#7C3AED', desc: 'Large institutional-grade wallet' };
    // Whale
    if (usd > 1000000) return { type: 'Whale', color: '#F59E0B', desc: 'High-net-worth crypto holder' };
    // Smart Money
    if ((analysis?.overallScore || 0) >= 75 || tradingStyle.includes('degen') || tradingStyle.includes('defi')) {
      return { type: 'Smart Money', color: '#10B981', desc: 'Sophisticated trader with strong on-chain track record' };
    }
    // Retail
    return { type: 'Retail', color: '#0A1EFF', desc: 'Individual retail trader' };
  }

  const walletClassification = classifyWallet(walletData, aiAnalysis);

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
          <h1 className="text-sm font-heading font-bold">Wallet Intelligence</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex rounded-xl bg-[#0f1320] border border-[#1a1f2e] p-1">
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'wallet'
                ? 'bg-[#0A1EFF] text-white shadow-lg shadow-[#0A1EFF]/20'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Wallet
          </button>
          <button
            onClick={() => setActiveTab('contract')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'contract'
                ? 'bg-[#0A1EFF] text-white shadow-lg shadow-[#0A1EFF]/20'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Contract
          </button>
        </div>

        {activeTab === 'wallet' && (
          <>
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
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
                  onKeyDown={(e) => e.key === 'Enter' && handleWalletSearch()}
                  placeholder="Enter wallet address (0x... or SOL)"
                  className="flex-1 bg-[#0f1320] border border-[#1a1f2e] rounded-lg px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30"
                />
                <button
                  onClick={handleWalletSearch}
                  disabled={loading}
                  className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Scan
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
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
                <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
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
                      ...(walletData.firstSeen ? [{ label: 'First Seen', value: walletData.firstSeen, icon: Clock, color: '#10B981' }] : []),
                      ...(walletData.lastActive ? [{ label: 'Last Active', value: walletData.lastActive, icon: Activity, color: '#F59E0B' }] : []),
                    ].map((stat) => (
                      <div key={stat.label} className="bg-[#0f1320] rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <stat.icon className="w-3 h-3" style={{ color: stat.color }} />
                          <span className="text-[10px] text-gray-500">{stat.label}</span>
                        </div>
                        <div className="text-sm font-bold">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>


                {/* All Holdings */}
                <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">All Holdings</h3>
                    <span className="text-[10px] text-gray-500">{walletData.holdings.length} tokens</span>
                  </div>
                  <div className="space-y-1.5">
                    {walletData.holdings.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No holdings found</p>
                    ) : (
                      (showAllHoldings ? walletData.holdings : walletData.holdings.slice(0, 10)).map((h, i) => {
                        const val = h.valueUsd ? parseFloat(h.valueUsd) : 0;
                        const pct = totalUsd > 0 && val > 0 ? (val / totalUsd * 100) : 0;
                        return (
                          <div key={`${h.symbol}-${i}`} className="flex items-center justify-between py-2 border-b border-[#1a1f2e]/40 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-600 w-4 text-right">{i + 1}</span>
                              {h.logoUrl ? (
                                <img src={h.logoUrl} alt={h.symbol} className="w-7 h-7 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-full flex items-center justify-center text-[10px] font-bold text-[#0A1EFF]">
                                  {h.symbol.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="text-xs font-semibold">{h.symbol}</div>
                                <div className="text-[10px] text-gray-500 truncate max-w-[100px]">{h.name}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {pct > 0 && (
                                <div className="hidden sm:flex items-center gap-1.5 w-20">
                                  <div className="flex-1 bg-white/5 rounded-full h-1">
                                    <div className="h-1 rounded-full bg-[#0A1EFF]" style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                  <span className="text-[9px] text-gray-600 w-8 text-right">{pct.toFixed(1)}%</span>
                                </div>
                              )}
                              <div className="text-right">
                                <div className="text-xs font-semibold">
                                  {h.valueUsd && parseFloat(h.valueUsd) > 0 ? `$${parseFloat(h.valueUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                                </div>
                                <div className="text-[10px] text-gray-500">{parseFloat(h.balance) > 1000 ? parseFloat(h.balance).toLocaleString(undefined, { maximumFractionDigits: 0 }) : h.balance} {h.symbol}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {walletData.holdings.length > 10 && (
                    <button onClick={() => setShowAllHoldings(v => !v)}
                      className="w-full mt-2 py-2 text-[10px] text-[#0A1EFF] hover:bg-[#0A1EFF]/5 rounded-lg transition-colors flex items-center justify-center gap-1">
                      {showAllHoldings ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {walletData.holdings.length} holdings</>}
                    </button>
                  )}
                </div>

                {/* ─── Full DNA-Level AI Analysis ─── */}
                {aiLoading && (
                  <div className="bg-[#0f1320] rounded-2xl p-6 border border-[#1a1f2e] flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-[#0A1EFF] animate-spin flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">Running AI Analysis...</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Analyzing portfolio patterns and risk</div>
                    </div>
                  </div>
                )}
                {!aiLoading && aiAnalysis && (
                  <>
                    {/* Score + Grade */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e] text-center">
                        <div className="text-4xl font-black mb-1" style={{ color: scoreColor(aiAnalysis.overallScore) }}>{aiAnalysis.overallScore}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Overall Score</div>
                      </div>
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e] text-center">
                        <div className="text-4xl font-black mb-1 text-[#F59E0B]">{aiAnalysis.portfolioGrade}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Portfolio Grade</div>
                      </div>
                    </div>

                    {/* Trading Style + Classification */}
                    <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${walletClassification.color}20` }}>
                          <Brain className="w-5 h-5" style={{ color: walletClassification.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{aiAnalysis.tradingStyle}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: aiAnalysis.riskProfile?.toLowerCase().includes('ultra') ? '#EF4444' : aiAnalysis.riskProfile?.toLowerCase().includes('aggress') ? '#F59E0B' : '#10B981' }}>
                              {aiAnalysis.riskProfile}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{walletClassification.type} · {walletClassification.desc}</div>
                        </div>
                      </div>
                      {aiAnalysis.personalityTraits && aiAnalysis.personalityTraits.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {aiAnalysis.personalityTraits.map((t, i) => (
                            <span key={i} className="px-2 py-1 rounded-lg text-[10px] text-gray-300" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Performance Metrics Bars */}
                    {aiAnalysis.metrics && (
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                        <div className="flex items-center gap-2 mb-3">
                          <PieChart className="w-4 h-4 text-[#0A1EFF]" />
                          <h3 className="font-bold text-sm">Performance Metrics</h3>
                        </div>
                        <div className="space-y-3">
                          {[
                            { label: 'Diversification', value: aiAnalysis.metrics.diversification, color: aiAnalysis.metrics.diversification >= 60 ? '#10B981' : aiAnalysis.metrics.diversification >= 35 ? '#0A1EFF' : '#EF4444' },
                            { label: 'Timing', value: aiAnalysis.metrics.timing, color: aiAnalysis.metrics.timing >= 60 ? '#0A1EFF' : '#F59E0B' },
                            { label: 'Risk Management', value: aiAnalysis.metrics.riskManagement, color: aiAnalysis.metrics.riskManagement >= 60 ? '#10B981' : '#EF4444' },
                            { label: 'Conviction', value: aiAnalysis.metrics.conviction, color: '#10B981' },
                            { label: 'Consistency', value: aiAnalysis.metrics.consistency, color: '#7C3AED' },
                          ].map(m => (
                            <div key={m.label}>
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-400">{m.label}</span>
                                <span className="font-bold" style={{ color: m.color }}>{m.value}</span>
                              </div>
                              <div className="w-full bg-white/5 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full transition-all" style={{ width: `${m.value}%`, backgroundColor: m.color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Insight */}
                    {aiAnalysis.topInsight && (
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-[#0A1EFF]" />
                          <h3 className="font-bold text-sm">Key Insight</h3>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{aiAnalysis.topInsight}</p>
                      </div>
                    )}

                    {/* Strengths & Weaknesses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {aiAnalysis.strengths && aiAnalysis.strengths.length > 0 && (
                        <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#10B981]/20">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-[#10B981]" />
                            <span className="text-sm font-bold text-[#10B981]">Strengths</span>
                          </div>
                          <ul className="space-y-1.5">
                            {aiAnalysis.strengths.map((s, i) => (
                              <li key={i} className="text-[11px] text-gray-300 flex items-start gap-1.5">
                                <span className="text-[#10B981] mt-0.5 font-bold flex-shrink-0">+</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiAnalysis.weaknesses && aiAnalysis.weaknesses.length > 0 && (
                        <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#F59E0B]/20">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                            <span className="text-sm font-bold text-[#F59E0B]">Weaknesses</span>
                          </div>
                          <ul className="space-y-1.5">
                            {aiAnalysis.weaknesses.map((w, i) => (
                              <li key={i} className="text-[11px] text-gray-300 flex items-start gap-1.5">
                                <span className="text-[#F59E0B] mt-0.5 font-bold flex-shrink-0">!</span> {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* AI Recommendations */}
                    {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-[#7C3AED]" />
                          <h3 className="font-bold text-sm">AI Recommendations</h3>
                        </div>
                        <div className="space-y-2">
                          {aiAnalysis.recommendations.map((r, i) => (
                            <div key={i} className="flex items-start gap-3 py-2 border-b border-[#1a1f2e]/50 last:border-0">
                              <div className="w-5 h-5 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-[9px] font-bold text-[#7C3AED]">{i + 1}</span>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed">{r}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risk Assessment */}
                    {aiAnalysis.riskAssessment && (
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-[#EF4444]" />
                            <h3 className="font-bold text-sm">Risk Assessment</h3>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: aiAnalysis.riskAssessment.riskLevel === 'CRITICAL' ? '#EF444420' : aiAnalysis.riskAssessment.riskLevel === 'HIGH' ? '#F59E0B20' : '#10B98120', color: aiAnalysis.riskAssessment.riskLevel === 'CRITICAL' ? '#EF4444' : aiAnalysis.riskAssessment.riskLevel === 'HIGH' ? '#F59E0B' : '#10B981' }}>
                            {aiAnalysis.riskAssessment.riskLevel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed mb-2">{aiAnalysis.riskAssessment.summary}</p>
                        {aiAnalysis.riskAssessment.keyRisks && aiAnalysis.riskAssessment.keyRisks.length > 0 && (
                          <ul className="space-y-1">
                            {aiAnalysis.riskAssessment.keyRisks.map((risk, i) => (
                              <li key={i} className="text-[10px] text-[#EF4444] flex items-start gap-1.5">
                                <span className="mt-0.5 flex-shrink-0">▲</span> {risk}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Activity Pattern */}
                    {aiAnalysis.activityPattern && (
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-[#0A1EFF]" />
                          <h3 className="font-bold text-sm">Activity Pattern</h3>
                          <span className="text-[10px] text-gray-500 ml-auto">{aiAnalysis.activityPattern.estimatedFrequency}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{aiAnalysis.activityPattern.summary}</p>
                      </div>
                    )}

                    {/* Notable Behaviors */}
                    {aiAnalysis.notableBehaviors && aiAnalysis.notableBehaviors.length > 0 && (
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="w-4 h-4 text-[#7C3AED]" />
                          <h3 className="font-bold text-sm">Notable Behaviors</h3>
                        </div>
                        <div className="space-y-3">
                          {aiAnalysis.notableBehaviors.map((b, i) => (
                            <div key={i} className="border-b border-[#1a1f2e]/50 last:border-0 pb-2 last:pb-0">
                              <div className="text-xs font-semibold text-white mb-1">{b.behavior}</div>
                              <p className="text-[10px] text-gray-500 leading-relaxed">{b.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Market Outlook */}
                    {aiAnalysis.marketOutlook && (
                      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-[#10B981]" />
                          <h3 className="font-bold text-sm">Market Outlook</h3>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{aiAnalysis.marketOutlook}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Recent Transactions */}
                {walletData.recentTransactions && walletData.recentTransactions.length > 0 && (
                  <RecentTransactions
                    transactions={walletData.recentTransactions}
                    chain={walletData.chain}
                    walletAddress={walletData.address}
                  />
                )}
              </>
            )}

            {!walletData && !loading && !error && (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-500">Enter a wallet address to begin</h3>
                <p className="text-xs text-gray-600 mt-1">Supports Ethereum, Base, Polygon, Avalanche and Solana</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'contract' && (
          <>
            <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
              <h2 className="font-bold text-sm mb-2">Analyze Smart Contract</h2>
              <p className="text-[10px] text-gray-500 mb-3">Scan any token contract for security risks, honeypot detection, and tax analysis</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {CONTRACT_CHAINS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setContractChain(c.key)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border"
                    style={{
                      borderColor: contractChain === c.key ? c.color : 'rgba(255,255,255,0.1)',
                      backgroundColor: contractChain === c.key ? `${c.color}20` : 'transparent',
                      color: contractChain === c.key ? c.color : '#9CA3AF',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={contractInput}
                  onChange={(e) => setContractInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContractScan()}
                  placeholder="Enter contract address (0x...)"
                  className="flex-1 bg-[#0f1320] border border-[#1a1f2e] rounded-lg px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30"
                />
                <button
                  onClick={handleContractScan}
                  disabled={contractLoading}
                  className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {contractLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                  Scan
                </button>
              </div>
            </div>

            {contractError && (
              <div className="bg-[#0f1320] rounded-2xl p-4 border border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-xs text-red-400">{contractError}</span>
                </div>
              </div>
            )}

            {contractLoading && (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-[#0A1EFF] mx-auto mb-3 animate-spin" />
                <h3 className="text-sm font-semibold text-gray-400">Scanning contract...</h3>
                <p className="text-xs text-gray-600 mt-1">Analyzing security risks and tax structure</p>
              </div>
            )}

            {contractResult && !contractLoading && (
              <>
                <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${contractResult.safetyColor}20` }}>
                        <Shield className="w-5 h-5" style={{ color: contractResult.safetyColor }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{contractResult.name}</span>
                          <span className="text-xs text-gray-500">{contractResult.symbol}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-gray-500">{contractResult.contract.slice(0, 10)}...{contractResult.contract.slice(-8)}</span>
                          <button onClick={() => copyAddr(contractResult.contract, 'contract')} className="hover:text-[#0A1EFF] transition-colors">
                            {copied === 'contract' ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: contractResult.safetyColor }}>{contractResult.trustScore}</div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${contractResult.safetyColor}20`, color: contractResult.safetyColor }}>
                        {contractResult.safetyLevel}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Holders</div>
                      <div className="text-sm font-bold text-[#0A1EFF]">{contractResult.holderCount.toLocaleString()}</div>
                    </div>
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Buy Tax</div>
                      <div className="text-sm font-bold" style={{ color: parseFloat(contractResult.buyTax) > 5 ? '#EF4444' : '#10B981' }}>{contractResult.buyTax}</div>
                    </div>
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Sell Tax</div>
                      <div className="text-sm font-bold" style={{ color: parseFloat(contractResult.sellTax) > 5 ? '#EF4444' : '#10B981' }}>{contractResult.sellTax}</div>
                    </div>
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Honeypot</div>
                      <div className="text-sm font-bold" style={{ color: contractResult.isHoneypot ? '#EF4444' : '#10B981' }}>
                        {contractResult.isHoneypot ? 'YES' : 'NO'}
                      </div>
                    </div>
                  </div>

                  {contractResult.isHoneypot && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-xs text-red-400 font-medium">HONEYPOT DETECTED - Do not buy this token. You will not be able to sell.</span>
                    </div>
                  )}
                </div>

                {contractResult.dexData && (
                  <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-[#0A1EFF]" />
                      <h3 className="font-bold text-sm">Market Data</h3>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      <div className="bg-[#0a0e1a] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500">Price</div>
                        <div className="text-sm font-bold font-mono text-white">
                          ${contractResult.dexData.price < 0.01
                            ? contractResult.dexData.price.toFixed(8)
                            : contractResult.dexData.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </div>
                      </div>
                      <div className="bg-[#0a0e1a] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500">24h Change</div>
                        <div className="text-sm font-bold" style={{ color: contractResult.dexData.priceChange24h >= 0 ? '#10B981' : '#EF4444' }}>
                          {contractResult.dexData.priceChange24h >= 0 ? '+' : ''}{contractResult.dexData.priceChange24h.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-[#0a0e1a] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500">Market Cap</div>
                        <div className="text-sm font-bold font-mono text-white">
                          ${contractResult.dexData.marketCap > 1000000
                            ? (contractResult.dexData.marketCap / 1000000).toFixed(2) + 'M'
                            : contractResult.dexData.marketCap > 1000
                            ? (contractResult.dexData.marketCap / 1000).toFixed(1) + 'K'
                            : contractResult.dexData.marketCap.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-[#0a0e1a] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500">24h Volume</div>
                        <div className="text-sm font-bold font-mono text-white">
                          ${contractResult.dexData.volume24h > 1000000
                            ? (contractResult.dexData.volume24h / 1000000).toFixed(2) + 'M'
                            : contractResult.dexData.volume24h > 1000
                            ? (contractResult.dexData.volume24h / 1000).toFixed(1) + 'K'
                            : contractResult.dexData.volume24h.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-[#0a0e1a] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500">Liquidity</div>
                        <div className="text-sm font-bold font-mono text-white">
                          ${contractResult.dexData.liquidity > 1000000
                            ? (contractResult.dexData.liquidity / 1000000).toFixed(2) + 'M'
                            : contractResult.dexData.liquidity > 1000
                            ? (contractResult.dexData.liquidity / 1000).toFixed(1) + 'K'
                            : contractResult.dexData.liquidity.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-[#0a0e1a] rounded-lg p-2.5">
                        <div className="text-[9px] text-gray-500">FDV</div>
                        <div className="text-sm font-bold font-mono text-white">
                          ${contractResult.dexData.fdv > 1000000
                            ? (contractResult.dexData.fdv / 1000000).toFixed(2) + 'M'
                            : contractResult.dexData.fdv > 1000
                            ? (contractResult.dexData.fdv / 1000).toFixed(1) + 'K'
                            : contractResult.dexData.fdv.toFixed(0)}
                        </div>
                      </div>
                    </div>
                    {contractResult.dexData.url && (
                      <a href={contractResult.dexData.url} target="_blank" rel="noopener noreferrer"
                        className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#0A1EFF] hover:underline">
                        View on DexScreener <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                  <h3 className="font-bold text-sm mb-3">Security Checks</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {contractResult.checks.map((check, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#0f1320] rounded-lg p-2.5">
                        {check.status === 'pass' || check.status === 'safe' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        ) : check.status === 'fail' || check.status === 'danger' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        )}
                        <span className="text-xs text-gray-300">{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                  <h3 className="font-bold text-sm mb-3">Contract Details</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Creator', value: contractResult.creatorAddress },
                      { label: 'Owner', value: contractResult.ownerAddress },
                      { label: 'Total Supply', value: contractResult.totalSupply },
                      { label: 'Open Source', value: contractResult.isOpenSource ? 'Yes' : 'No' },
                      { label: 'Mintable', value: contractResult.isMintable ? 'Yes' : 'No' },
                      { label: 'Proxy', value: contractResult.isProxy ? 'Yes' : 'No' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-[#1a1f2e]/50 last:border-0">
                        <span className="text-[10px] text-gray-500">{item.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-gray-300">
                            {item.value.length > 20 ? `${item.value.slice(0, 10)}...${item.value.slice(-8)}` : item.value}
                          </span>
                          {item.value.startsWith('0x') && (
                            <button onClick={() => copyAddr(item.value, item.label)} className="hover:text-[#0A1EFF] transition-colors">
                              {copied === item.label ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-600" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!contractResult && !contractLoading && !contractError && (
              <div className="text-center py-12">
                <FileCode className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-500">Enter a contract address to scan</h3>
                <p className="text-xs text-gray-600 mt-1">Honeypot detection, tax analysis, and security checks</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
