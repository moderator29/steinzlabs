'use client';

import { Search, Wallet, TrendingUp, Clock, DollarSign, Activity, ExternalLink, Loader2, AlertCircle, Shield, PieChart, FileCode, ArrowRight, Copy, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Send, ArrowDownLeft, RefreshCw, Zap, Brain, GitCompare } from 'lucide-react';
import Link from 'next/link';
import BackButton from '@/components/ui/BackButton';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useNavState } from '@/lib/nav/useNavState';

type TabMode = 'wallet' | 'contract';

interface RecentTx {
  hash: string;
  blockTime: string | null;
  status: 'success' | 'failed';
  type?: string;
  asset?: string;
  value?: number | string;
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
  // Per-holding GoPlus security (already fetched by the API for top tokens —
  // surfaced here so risky bags are flagged instead of silently dropped).
  contractSecurity?: Record<string, {
    isHoneypot: boolean;
    trustScore: number;
    trustLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
    flags: { name: string; severity: string }[];
  } | null>;
  tokenDistribution?: { symbol: string; percentage: number }[];
  isWhale?: boolean;
  whaleScore?: number;
  // Top counterparties derived from real recent transactions.
  counterparties?: Array<{
    address: string;
    count: number;
    inbound: number;
    outbound: number;
    label: string | null;
    category: string | null;
    parent: string | null;
  }>;
  // Realized PnL from real Bitquery DEX trades (90d), FIFO cost basis.
  realizedPnl?: {
    byToken: Array<{ token: string; tokenSymbol: string | null; totalRealizedUsd: number; winRate: number; lots: number }>;
    totalRealizedUsd: number;
    totalProceedsUsd: number;
    totalCostBasisUsd: number;
    closedLots: number;
    winRate: number;
    averageHoldDays: number;
  } | null;
}

interface MultiChainResult {
  address: string;
  totalUsd: number;
  chainsWithBalance: number;
  chainsScanned: number;
  breakdown: Array<{
    chain: string;
    chainName: string;
    nativeSymbol: string;
    totalBalanceUsd: number;
    tokenCount: number;
    txCount: number;
  }>;
}

const CHAIN_DOT: Record<string, string> = {
  ethereum: '#627EEA', base: '#0052FF', arbitrum: '#28A0F0',
  polygon: '#8247E5', avalanche: '#E84142', bsc: '#F0B90B',
};

// ─── Multi-Chain Aggregate ──────────────────────────────────────────────────────
// One net-worth figure across every supported EVM chain, with a per-chain
// breakdown bar. Real priced balances only; renders nothing until the lazy
// fetch returns at least one chain with a balance.
function MultiChainBalances({ data, loading }: { data: MultiChainResult | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e] flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0066FF]" /> Aggregating balances across chains…
      </div>
    );
  }
  if (!data || data.breakdown.length === 0) return null;
  const priced = data.breakdown.filter(c => c.totalBalanceUsd > 0);
  if (priced.length === 0) return null;
  const total = data.totalUsd || priced.reduce((s, c) => s + c.totalBalanceUsd, 0);

  return (
    <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#0066FF]" />
          <h3 className="font-bold text-sm">Multi-Chain Net Worth</h3>
        </div>
        <span className="text-[10px] text-gray-500">{data.chainsWithBalance} of {data.chainsScanned} chains</span>
      </div>
      <div className="text-2xl font-bold text-white">
        ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      {/* Stacked proportion bar */}
      <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-black/30">
        {priced.map(c => (
          <div
            key={c.chain}
            style={{ width: `${(c.totalBalanceUsd / total) * 100}%`, backgroundColor: CHAIN_DOT[c.chain] ?? '#6F7EFF' }}
            title={`${c.chainName} · $${c.totalBalanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {priced.map(c => (
          <div key={c.chain} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHAIN_DOT[c.chain] ?? '#6F7EFF' }} />
              <span className="font-semibold text-white truncate">{c.chainName}</span>
              <span className="text-[10px] text-gray-500">{c.tokenCount} {c.tokenCount === 1 ? 'token' : 'tokens'}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-gray-300">${c.totalBalanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-gray-600 font-mono w-9 text-end">{Math.round((c.totalBalanceUsd / total) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Transactions ───────────────────────────────────────────────────────
function RecentTransactions({ transactions, chain, walletAddress }: { transactions: RecentTx[]; chain: string; walletAddress: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? transactions : transactions.slice(0, 15);
  const explorerBase = chain === 'Solana' ? 'https://solscan.io/tx/' : 'https://etherscan.io/tx/';

  function formatTime(blockTime: string | null) {
    if (!blockTime) return 'unknown';
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
    return <RefreshCw className="w-3 h-3 text-[#0066FF]" />;
  }

  function txColor(type: string | undefined) {
    if (type === 'send') return 'var(--nl-error)';
    if (type === 'receive') return 'var(--nl-success)';
    return 'var(--nl-blue)';
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
                    {(() => {
                      // value arrives as a string from the API (EVM/Solana both
                      // serialize it as text), so coerce before any numeric use.
                      const v = Number(tx.value);
                      if (!Number.isFinite(v) || v <= 0) return null;
                      return (
                        <span className="text-[10px] font-mono text-gray-300">
                          {v < 0.001 ? v.toFixed(6) : v.toFixed(4)}
                        </span>
                      );
                    })()}
                    {tx.memo && <span className="text-[9px] text-gray-600 italic truncate">{tx.memo.slice(0, 20)}</span>}
                  </div>
                  <div className="text-[9px] font-mono text-gray-600">{tx.hash.slice(0, 12)}...{tx.hash.slice(-6)}</div>
                </div>
                <div className="text-end flex-shrink-0">
                  <div className="text-[9px] text-gray-500">{formatTime(tx.blockTime)}</div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className={`text-[9px] font-semibold ${tx.status === 'failed' ? 'text-red-400' : 'text-green-400'}`}>
                      {tx.status === 'failed' ? '✗' : '✓'}
                    </span>
                    <a href={`${explorerBase}${tx.hash}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-2.5 h-2.5 text-gray-600 hover:text-[#0066FF]" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {transactions.length > 15 && (
            <button onClick={() => setExpanded(e => !e)}
              className="w-full mt-2 py-2 text-[10px] text-[#0066FF] hover:bg-[#0066FF]/5 rounded-lg transition-colors flex items-center justify-center gap-1">
              {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {transactions.length} transactions</>}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Activity Heatmap ──────────────────────────────────────────────────────────
// When (UTC) this wallet actually transacts, bucketed from real on-chain tx
// timestamps into a 7-day x 4-block grid. No synthetic fill — cells reflect
// only observed transactions, and the whole card hides when the sample is too
// thin to be meaningful.
const HEATMAP_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// 6-hour blocks labelled by their start hour (no dash ranges — clean axis).
const HEATMAP_BLOCKS = ['00h', '06h', '12h', '18h'];
const HEATMAP_BLOCK_RANGE = ['00:00→06:00', '06:00→12:00', '12:00→18:00', '18:00→24:00'];

function ActivityHeatmap({ transactions }: { transactions: RecentTx[] }) {
  const stamped = transactions.filter(t => t.blockTime);
  if (stamped.length < 4) return null;

  // grid[day][block] = count. Day 0 = Sunday to match Date.getUTCDay().
  const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  let total = 0;
  for (const tx of stamped) {
    const d = new Date(tx.blockTime as string);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getUTCDay();
    const block = Math.min(3, Math.floor(d.getUTCHours() / 6));
    grid[day][block]++;
    total++;
  }
  if (total < 4) return null;

  const max = Math.max(...grid.flat());
  // Peak window for a one-line human summary.
  let peakDay = 0, peakBlock = 0, peakCount = 0;
  grid.forEach((row, di) => row.forEach((c, bi) => { if (c > peakCount) { peakCount = c; peakDay = di; peakBlock = bi; } }));

  const cellColor = (count: number) => {
    if (count === 0) return 'rgba(255,255,255,0.03)';
    const t = max > 0 ? count / max : 0;
    // Blue→purple ramp matching the Naka palette; alpha scales with intensity.
    return `rgba(${Math.round(0 + t * 90)}, ${Math.round(102 - t * 30)}, ${Math.round(255 - t * 40)}, ${0.18 + t * 0.72})`;
  };

  return (
    <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#0066FF]" />
          <h3 className="font-bold text-sm">Activity Heatmap <span className="text-[10px] text-gray-500 font-normal">· UTC</span></h3>
        </div>
        <span className="text-[10px] text-gray-500">{total} tx</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[28px_repeat(4,1fr)] gap-1 items-center">
          <div />
          {HEATMAP_BLOCKS.map(b => (
            <div key={b} className="text-[8px] text-gray-500 text-center font-mono">{b}</div>
          ))}
        </div>
        {grid.map((row, di) => (
          <div key={di} className="grid grid-cols-[28px_repeat(4,1fr)] gap-1 items-center">
            <div className="text-[9px] text-gray-500 font-mono">{HEATMAP_DAYS[di]}</div>
            {row.map((count, bi) => (
              <div
                key={bi}
                className="h-6 rounded-md flex items-center justify-center transition-colors"
                style={{ backgroundColor: cellColor(count) }}
                title={`${HEATMAP_DAYS[di]} ${HEATMAP_BLOCK_RANGE[bi]} UTC · ${count} tx`}
              >
                {count > 0 && <span className="text-[9px] font-mono font-semibold text-white/90">{count}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] text-gray-500">
        Most active <span className="text-gray-300 font-semibold">{HEATMAP_DAYS[peakDay]}</span> around <span className="text-gray-300 font-semibold">{HEATMAP_BLOCK_RANGE[peakBlock]} UTC</span>
      </div>
    </div>
  );
}

// ─── Counterparty Links ─────────────────────────────────────────────────────
// Who this wallet trades with most, from real recent transactions. Known
// entities (CEX / DEX / bridge / mixer) get a coloured category tag; unknown
// addresses link out to the explorer.
const CP_CATEGORY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  cex: { label: 'CEX', color: '#F0B90B', bg: 'rgba(240,185,11,0.12)' },
  dex: { label: 'DEX', color: '#6F7EFF', bg: 'rgba(111,126,255,0.12)' },
  bridge: { label: 'Bridge', color: '#28A0F0', bg: 'rgba(40,160,240,0.12)' },
  mixer: { label: 'Mixer', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  'market-maker': { label: 'Market Maker', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  lending: { label: 'Lending', color: '#8B7CFF', bg: 'rgba(139,124,255,0.12)' },
};

function CounterpartyLinks({
  counterparties, chain,
}: {
  counterparties: NonNullable<WalletData['counterparties']>;
  chain: string;
}) {
  if (!counterparties || counterparties.length === 0) return null;
  const explorerBase = chain === 'Solana' ? 'https://solscan.io/account/' : 'https://etherscan.io/address/';
  const maxCount = Math.max(...counterparties.map(c => c.count));

  return (
    <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#7C3AED]" />
          <h3 className="font-bold text-sm">Top Counterparties</h3>
        </div>
        <span className="text-[10px] text-gray-500">most frequent</span>
      </div>
      <div className="space-y-2">
        {counterparties.map((cp) => {
          const style = cp.category ? CP_CATEGORY_STYLE[cp.category] : null;
          const name = cp.label || `${cp.address.slice(0, 6)}…${cp.address.slice(-4)}`;
          return (
            <a
              key={cp.address}
              href={`${explorerBase}${cp.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-white truncate group-hover:text-[#6F7EFF] transition-colors">{name}</span>
                  {style && (
                    <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                      style={{ color: style.color, backgroundColor: style.bg }}>
                      {style.label}
                    </span>
                  )}
                  {cp.parent && cp.parent !== cp.label && (
                    <span className="text-[9px] text-gray-500 flex-shrink-0">{cp.parent}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] text-gray-500 font-mono">
                    <span className="text-emerald-400">{cp.inbound}↓</span> <span className="text-red-400">{cp.outbound}↑</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-300 w-6 text-end">{cp.count}</span>
                </div>
              </div>
              <div className="h-1 rounded-full bg-black/30 mt-1 overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${(cp.count / maxCount) * 100}%`, backgroundColor: style?.color ?? '#6F7EFF' }} />
              </div>
            </a>
          );
        })}
      </div>
      <div className="mt-2.5 text-[9px] text-gray-600">
        <span className="text-emerald-400">↓</span> received from · <span className="text-red-400">↑</span> sent to · from recent transactions
      </div>
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

  // PDF S3 — preserve tab + last-searched address + chain across
  // wallet-intel → DNA detail → back so the user lands back in the
  // same lookup state.
  useNavState(
    'wallet-intelligence',
    () => ({ activeTab, address, selectedChain }),
    (s) => {
      if (s.activeTab === 'wallet' || s.activeTab === 'contract') setActiveTab(s.activeTab);
      if (typeof s.address === 'string') setAddress(s.address);
      if (typeof s.selectedChain === 'string') setSelectedChain(s.selectedChain);
    },
  );
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [multiChain, setMultiChain] = useState<MultiChainResult | null>(null);
  const [multiChainLoading, setMultiChainLoading] = useState(false);
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
    setMultiChain(null);
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

      // Lazy multi-chain aggregate (EVM only) — runs after the primary view so
      // it never blocks first paint. The viewed chain is a cache hit server-side.
      if (addrType === 'EVM') {
        setMultiChainLoading(true);
        fetch(`/api/wallet-intelligence/multichain?address=${encodeURIComponent(trimmed)}`)
          .then(r => (r.ok ? r.json() : null))
          .then(mc => { if (mc && Array.isArray(mc.breakdown)) setMultiChain(mc); })
          .catch(() => {})
          .finally(() => setMultiChainLoading(false));
      }

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
    if (score >= 70) return 'var(--nl-success)';
    if (score >= 40) return 'var(--nl-warning)';
    return 'var(--nl-error)';
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
    if (txCount > 500 && usd < 50000) return { type: 'Bot / MEV', color: 'var(--nl-error)', desc: 'High-frequency automated activity detected' };
    // Dormant (very few txns)
    if (txCount < 3) return { type: 'Dormant', color: '#6B7280', desc: 'Low activity wallet, possibly inactive' };
    // Institutional (very large balance)
    if (usd > 10000000) return { type: 'Institutional', color: 'var(--nl-purple)', desc: 'Large institutional-grade wallet' };
    // Whale
    if (usd > 1000000) return { type: 'Whale', color: 'var(--nl-warning)', desc: 'High-net-worth crypto holder' };
    // Smart Money
    if ((analysis?.overallScore || 0) >= 75 || tradingStyle.includes('degen') || tradingStyle.includes('defi')) {
      return { type: 'Smart Money', color: 'var(--nl-success)', desc: 'Sophisticated trader with strong on-chain track record' };
    }
    // Retail
    return { type: 'Retail', color: 'var(--nl-blue)', desc: 'Individual retail trader' };
  }

  const walletClassification = classifyWallet(walletData, aiAnalysis);

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
          <h1 className="text-sm font-heading font-bold">Wallet Intelligence</h1>
          {/* §9.3 new feature — Compare two wallets side-by-side. Routes
              to a dedicated comparison page that fetches both addresses
              in parallel and surfaces the diff. */}
          <Link
            href="/dashboard/wallet-intelligence/compare"
            className="ms-auto whale-pill"
            title="Compare two wallets side by side"
          >
            <GitCompare className="w-3.5 h-3.5" aria-hidden="true" />
            Compare
          </Link>
          <Link
            href="/dashboard/security/wallet-analysis"
            className="whale-pill"
            title="Run a Shadow Guardian scan in the Security Center"
          >
            Wallet scan →
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex rounded-xl bg-[#0f1320] border border-[#1a1f2e] p-1">
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'wallet'
                ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/20'
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
                ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/20'
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
                  className="flex-1 bg-[#0f1320] border border-[#1a1f2e] rounded-lg px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/30"
                />
                <button
                  onClick={handleWalletSearch}
                  disabled={loading}
                  className="bg-gradient-to-r from-[#0066FF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
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
                <Loader2 className="w-10 h-10 text-[#0066FF] mx-auto mb-3 animate-spin" />
                <h3 className="text-sm font-semibold text-gray-400">Scanning wallet...</h3>
                <p className="text-xs text-gray-600 mt-1">Fetching on-chain data</p>
              </div>
            )}

            {walletData && !loading && (
              <>
                <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#0066FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-[#0066FF]" />
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
                      className="flex items-center gap-1 text-[10px] text-[#0066FF] hover:underline"
                    >
                      Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { label: 'Total Balance', value: totalUsd > 0 ? `$${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$0.00', icon: DollarSign, color: 'var(--nl-success)' },
                      { label: 'TX Count', value: walletData.txCount.toLocaleString(), icon: Activity, color: 'var(--nl-purple)' },
                      { label: 'Tokens Held', value: walletData.holdings.length.toString(), icon: TrendingUp, color: 'var(--nl-blue)' },
                      { label: 'Chain', value: walletData.chain, icon: Clock, color: 'var(--nl-warning)' },
                      ...(walletData.firstSeen ? [{ label: 'First Seen', value: walletData.firstSeen, icon: Clock, color: 'var(--nl-success)' }] : []),
                      ...(walletData.lastActive ? [{ label: 'Last Active', value: walletData.lastActive, icon: Activity, color: 'var(--nl-warning)' }] : []),
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


                {/* Multi-chain net worth — EVM only, lazy aggregate across chains */}
                <MultiChainBalances data={multiChain} loading={multiChainLoading} />

                {/* Realized PnL (90d) — real FIFO cost basis from Bitquery DEX
                    trades. Only shown when there are priced trades to report. */}
                {walletData.realizedPnl && walletData.realizedPnl.closedLots > 0 && (() => {
                  const p = walletData.realizedPnl!;
                  const pos = p.totalRealizedUsd >= 0;
                  const fmtPnl = (n: number) => n >= 0
                    ? `+$${Math.round(n).toLocaleString()}`
                    : `($${Math.round(Math.abs(n)).toLocaleString()})`;
                  return (
                    <div className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e]">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm">Realized PnL <span className="text-[10px] text-gray-500 font-normal">· 90d · FIFO</span></h3>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0066FF]/10 text-[#6F7EFF] border border-[#0066FF]/25 font-semibold">REAL TRADE DATA</span>
                      </div>
                      <div className={`text-2xl font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPnl(p.totalRealizedUsd)}</div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-black/20 rounded-lg p-2">
                          <div className="text-[9px] uppercase tracking-wider text-gray-500">Win rate</div>
                          <div className={`text-sm font-bold font-mono mt-0.5 ${p.winRate >= 50 ? 'text-emerald-400' : 'text-gray-300'}`}>{p.winRate}%</div>
                        </div>
                        <div className="bg-black/20 rounded-lg p-2">
                          <div className="text-[9px] uppercase tracking-wider text-gray-500">Closed lots</div>
                          <div className="text-sm font-bold font-mono mt-0.5 text-white">{p.closedLots}</div>
                        </div>
                        <div className="bg-black/20 rounded-lg p-2">
                          <div className="text-[9px] uppercase tracking-wider text-gray-500">Avg hold</div>
                          <div className="text-sm font-bold font-mono mt-0.5 text-white">{p.averageHoldDays >= 1 ? `${p.averageHoldDays.toFixed(1)}d` : `${Math.round(p.averageHoldDays * 24)}h`}</div>
                        </div>
                      </div>
                      {p.byToken.length > 0 && (() => {
                        const best = p.byToken[0];
                        const worst = p.byToken[p.byToken.length - 1];
                        const showWorst = p.byToken.length > 1 && worst.totalRealizedUsd < 0;
                        // best is the top token by realized PnL; it can itself be
                        // a net loss when every token lost, so colour honestly.
                        const bestPos = best.totalRealizedUsd >= 0;
                        const sym = (t: { tokenSymbol: string | null; token: string }) => t.tokenSymbol || `${t.token.slice(0, 6)}…${t.token.slice(-4)}`;
                        return (
                          <>
                            {/* Best & worst token by realized PnL */}
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <div className={`rounded-lg p-2.5 border ${bestPos ? 'bg-emerald-500/[0.08] border-emerald-500/20' : 'bg-red-500/[0.08] border-red-500/20'}`}>
                                <div className={`text-[9px] uppercase tracking-wider ${bestPos ? 'text-emerald-300/70' : 'text-red-300/70'}`}>Best token</div>
                                <div className="text-xs font-semibold text-white truncate mt-0.5">{sym(best)}</div>
                                <div className={`text-sm font-mono font-bold mt-0.5 ${bestPos ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPnl(best.totalRealizedUsd)}</div>
                              </div>
                              {showWorst ? (
                                <div className="bg-red-500/[0.08] border border-red-500/20 rounded-lg p-2.5">
                                  <div className="text-[9px] uppercase tracking-wider text-red-300/70">Worst token</div>
                                  <div className="text-xs font-semibold text-white truncate mt-0.5">{sym(worst)}</div>
                                  <div className="text-sm font-mono font-bold text-red-400 mt-0.5">{fmtPnl(worst.totalRealizedUsd)}</div>
                                </div>
                              ) : (
                                <div className="bg-black/20 border border-[#1a1f2e] rounded-lg p-2.5 flex flex-col justify-center">
                                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Losing tokens</div>
                                  <div className="text-xs font-semibold text-emerald-300 mt-0.5">None in window</div>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 space-y-1">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Top tokens by realized PnL</div>
                              {p.byToken.slice(0, 3).map((t) => (
                                <div key={t.token} className="flex items-center justify-between text-xs py-1 border-b border-[#1a1f2e]/40 last:border-0">
                                  <span className="font-semibold text-white truncate max-w-[140px]">{sym(t)} <span className="text-[10px] text-gray-500 font-normal">{t.winRate}% win</span></span>
                                  <span className={t.totalRealizedUsd >= 0 ? 'text-emerald-400 font-mono' : 'text-red-400 font-mono'}>{fmtPnl(t.totalRealizedUsd)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Activity heatmap — when (UTC) this wallet transacts, from real tx timestamps */}
                <ActivityHeatmap transactions={walletData.recentTransactions ?? []} />

                {/* Top counterparties — who this wallet trades with most */}
                {walletData.counterparties && walletData.counterparties.length > 0 && (
                  <CounterpartyLinks counterparties={walletData.counterparties} chain={walletData.chain} />
                )}

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
                        // Per-holding GoPlus security (already fetched by the API) — flag risky bags.
                        const sec = h.contractAddress ? walletData.contractSecurity?.[h.contractAddress.toLowerCase()] : null;
                        const risky = !!sec && (sec.isHoneypot || sec.trustLevel === 'DANGER' || sec.trustLevel === 'WARNING' || (sec.flags?.length ?? 0) > 0);
                        return (
                          <div key={`${h.symbol}-${i}`} className="flex items-center justify-between py-2 border-b border-[#1a1f2e]/40 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-600 w-4 text-end">{i + 1}</span>
                              {h.logoUrl ? (
                                <img src={h.logoUrl} alt={h.symbol} className="w-7 h-7 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="w-7 h-7 bg-[#0066FF]/10 rounded-full flex items-center justify-center text-[10px] font-bold text-[#0066FF]">
                                  {h.symbol.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold">{h.symbol}</span>
                                  {sec && (risky ? (
                                    <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 font-bold uppercase tracking-wide" title={sec.flags?.map(f => f.name).join(', ') || sec.trustLevel}>
                                      {sec.isHoneypot ? 'Honeypot' : sec.trustLevel}
                                    </span>
                                  ) : sec.trustLevel === 'SAFE' ? (
                                    <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-bold uppercase tracking-wide">Safe</span>
                                  ) : null)}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate max-w-[100px]">{h.name}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {pct > 0 && (
                                <div className="flex items-center gap-1.5 w-12 sm:w-20">
                                  {/* Bar hidden on small screens to save space; numeric % always visible */}
                                  <div className="hidden sm:block flex-1 bg-white/5 rounded-full h-1">
                                    <div className="h-1 rounded-full bg-[#0066FF]" style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                  <span className="text-[9px] text-gray-600 w-full sm:w-8 text-end">{pct.toFixed(1)}%</span>
                                </div>
                              )}
                              <div className="text-end">
                                <div className="text-xs font-semibold">
                                  {h.valueUsd && parseFloat(h.valueUsd) > 0 ? `$${parseFloat(h.valueUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'No price'}
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
                      className="w-full mt-2 py-2 text-[10px] text-[#0066FF] hover:bg-[#0066FF]/5 rounded-lg transition-colors flex items-center justify-center gap-1">
                      {showAllHoldings ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {walletData.holdings.length} holdings</>}
                    </button>
                  )}
                </div>

                {/* ─── Full DNA-Level AI Analysis ─── */}
                {aiLoading && (
                  <div className="bg-[#0f1320] rounded-2xl p-6 border border-[#1a1f2e] flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-[#0066FF] animate-spin flex-shrink-0" />
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
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: aiAnalysis.riskProfile?.toLowerCase().includes('ultra') ? 'var(--nl-error)' : aiAnalysis.riskProfile?.toLowerCase().includes('aggress') ? 'var(--nl-warning)' : 'var(--nl-success)' }}>
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
                          <PieChart className="w-4 h-4 text-[#0066FF]" />
                          <h3 className="font-bold text-sm">Performance Metrics</h3>
                        </div>
                        <div className="space-y-3">
                          {/* Only render metrics with a REAL value. The analyzer
                              now grounds only `diversification` (timing/risk/
                              conviction/consistency were ungrounded LLM guesses
                              and were removed) — so the empty bars are filtered
                              out instead of showing 0%/undefined. */}
                          {[
                            { label: 'Diversification', value: aiAnalysis.metrics.diversification, color: (aiAnalysis.metrics.diversification ?? 0) >= 60 ? 'var(--nl-success)' : (aiAnalysis.metrics.diversification ?? 0) >= 35 ? 'var(--nl-blue)' : 'var(--nl-error)' },
                            { label: 'Timing', value: aiAnalysis.metrics.timing, color: (aiAnalysis.metrics.timing ?? 0) >= 60 ? 'var(--nl-blue)' : 'var(--nl-warning)' },
                            { label: 'Risk Management', value: aiAnalysis.metrics.riskManagement, color: (aiAnalysis.metrics.riskManagement ?? 0) >= 60 ? 'var(--nl-success)' : 'var(--nl-error)' },
                            { label: 'Conviction', value: aiAnalysis.metrics.conviction, color: 'var(--nl-success)' },
                            { label: 'Consistency', value: aiAnalysis.metrics.consistency, color: 'var(--nl-purple)' },
                          ].filter(m => typeof m.value === 'number').map(m => (
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
                          <Zap className="w-4 h-4 text-[#0066FF]" />
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
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: aiAnalysis.riskAssessment.riskLevel === 'CRITICAL' ? '#EF444420' : aiAnalysis.riskAssessment.riskLevel === 'HIGH' ? '#F59E0B20' : '#10B98120', color: aiAnalysis.riskAssessment.riskLevel === 'CRITICAL' ? 'var(--nl-error)' : aiAnalysis.riskAssessment.riskLevel === 'HIGH' ? 'var(--nl-warning)' : 'var(--nl-success)' }}>
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
                          <Activity className="w-4 h-4 text-[#0066FF]" />
                          <h3 className="font-bold text-sm">Activity Pattern</h3>
                          <span className="text-[10px] text-gray-500 ms-auto">{aiAnalysis.activityPattern.estimatedFrequency}</span>
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
                  className="flex-1 bg-[#0f1320] border border-[#1a1f2e] rounded-lg px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/30"
                />
                <button
                  onClick={handleContractScan}
                  disabled={contractLoading}
                  className="bg-gradient-to-r from-[#0066FF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
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
                <Loader2 className="w-10 h-10 text-[#0066FF] mx-auto mb-3 animate-spin" />
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
                          <button onClick={() => copyAddr(contractResult.contract, 'contract')} className="hover:text-[#0066FF] transition-colors">
                            {copied === 'contract' ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-2xl font-bold" style={{ color: contractResult.safetyColor }}>{contractResult.trustScore}</div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${contractResult.safetyColor}20`, color: contractResult.safetyColor }}>
                        {contractResult.safetyLevel}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Holders</div>
                      <div className="text-sm font-bold text-[#0066FF]">{contractResult.holderCount.toLocaleString()}</div>
                    </div>
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Buy Tax</div>
                      <div className="text-sm font-bold" style={{ color: parseFloat(contractResult.buyTax) > 5 ? 'var(--nl-error)' : 'var(--nl-success)' }}>{contractResult.buyTax}</div>
                    </div>
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Sell Tax</div>
                      <div className="text-sm font-bold" style={{ color: parseFloat(contractResult.sellTax) > 5 ? 'var(--nl-error)' : 'var(--nl-success)' }}>{contractResult.sellTax}</div>
                    </div>
                    <div className="bg-[#0f1320] rounded-lg p-2.5 text-center">
                      <div className="text-[9px] text-gray-500">Honeypot</div>
                      <div className="text-sm font-bold" style={{ color: contractResult.isHoneypot ? 'var(--nl-error)' : 'var(--nl-success)' }}>
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
                      <TrendingUp className="w-4 h-4 text-[#0066FF]" />
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
                        <div className="text-sm font-bold" style={{ color: contractResult.dexData.priceChange24h >= 0 ? 'var(--nl-success)' : 'var(--nl-error)' }}>
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
                        className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#0066FF] hover:underline">
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
                            <button onClick={() => copyAddr(item.value, item.label)} className="hover:text-[#0066FF] transition-colors">
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
