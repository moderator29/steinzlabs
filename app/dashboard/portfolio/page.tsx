'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, RotateCcw, PieChart, ArrowUpRight, ArrowDownRight, Plus, ExternalLink, BarChart3, Download, Clock, DollarSign, ShieldAlert, ShieldCheck, ShieldX, ShieldQuestion, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';

interface Token {
  symbol: string;
  name: string;
  balance: string;
  price: number;
  valueUsd: number;
  change24h: number;
  contractAddress: string;
  logo?: string;
}

interface TokenRisk {
  contractAddress: string;
  symbol: string;
  riskLevel: 'safe' | 'warning' | 'danger' | 'unknown';
  score: number;
  flags: string[];
  details: {
    isHoneypot: boolean;
    isMintable: boolean;
    isProxy: boolean;
    isBlacklisted: boolean;
    selfDestruct: boolean;
    hiddenOwner: boolean;
    buyTax: number | null;
    sellTax: number | null;
    holderCount: number | null;
    top10HolderPercent: number | null;
    lpLockedPercent: number | null;
    creatorPercent: number | null;
  };
}

interface RiskSummary {
  scanned: number;
  safe: number;
  warning: number;
  danger: number;
  unknown: number;
  avgScore: number;
  portfolioRisk: 'safe' | 'moderate' | 'high' | 'critical';
}

const RISK_CONFIG = {
  safe:    { color: '#10B981', bg: '#10B98115', label: 'Safe',    Icon: ShieldCheck },
  warning: { color: '#F59E0B', bg: '#F59E0B15', label: 'Warning', Icon: ShieldAlert },
  danger:  { color: '#EF4444', bg: '#EF444415', label: 'Danger',  Icon: ShieldX },
  unknown: { color: '#6B7280', bg: '#6B728015', label: 'Unknown', Icon: ShieldQuestion },
} as const;

const PORTFOLIO_RISK_CONFIG = {
  safe:     { color: '#10B981', label: 'Low Risk',      Icon: ShieldCheck },
  moderate: { color: '#F59E0B', label: 'Moderate Risk', Icon: ShieldAlert },
  high:     { color: '#F97316', label: 'High Risk',     Icon: ShieldAlert },
  critical: { color: '#EF4444', label: 'Critical Risk', Icon: ShieldX },
} as const;

type TabId = 'balance' | 'history' | 'unrealized' | 'pnl';
type PnlRange = '1W' | '2W' | '3W' | '1M' | '3M' | 'All';
type HistoryRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'All';

const COLORS = ['#0A1EFF', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899'];

const KNOWN_LOGOS: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png',
  DAI: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  CRV: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  MKR: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
  ATOM: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
};

function TokenLogo({ symbol, logo, fallbackColor }: { symbol: string; logo?: string; fallbackColor: string }) {
  const [imgError, setImgError] = useState(false);
  const src = logo || KNOWN_LOGOS[symbol.toUpperCase()];

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={symbol}
        className="w-9 h-9 rounded-full flex-shrink-0 bg-[#111827]"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: `${fallbackColor}20`, color: fallbackColor }}>
      {symbol.slice(0, 2)}
    </div>
  );
}

function fmtUsd(v: number, decimals = 2) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function pctColor(v: number) {
  return v >= 0 ? '#10B981' : '#EF4444';
}

function MiniBar({ data }: { data: number[] }) {
  const max = Math.max(...data.map(Math.abs));
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${(Math.abs(v) / (max || 1)) * 100}%`,
            backgroundColor: v >= 0 ? '#10B981' : '#EF4444',
            minHeight: '3px',
            opacity: 0.7 + (i / data.length) * 0.3,
          }}
        />
      ))}
    </div>
  );
}

function RiskBadge({ risk }: { risk: TokenRisk | undefined }) {
  if (!risk) return null;
  const cfg = RISK_CONFIG[risk.riskLevel];
  const Icon = cfg.Icon;
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
      title={risk.flags.join(', ') || 'No issues detected'}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </div>
  );
}

function RiskBanner({
  summary,
  riskResults,
  portfolio,
  loading,
  expanded,
  onToggle,
  onDismiss,
  onRescan,
}: {
  summary: RiskSummary | null;
  riskResults: Record<string, TokenRisk>;
  portfolio: Token[];
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  onRescan: () => void;
}) {
  if (!summary && !loading) return null;

  if (loading) {
    return (
      <div className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.02] flex items-center gap-2 text-xs text-gray-400">
        <div className="w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin flex-shrink-0" />
        Scanning portfolio for security risks...
      </div>
    );
  }

  if (!summary) return null;

  const pRisk = PORTFOLIO_RISK_CONFIG[summary.portfolioRisk];
  const PRIcon = pRisk.Icon;
  const flaggedTokens = portfolio.filter(t => {
    const r = riskResults[t.contractAddress?.toLowerCase()];
    return r && (r.riskLevel === 'danger' || r.riskLevel === 'warning');
  });

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: `${pRisk.color}30`, backgroundColor: `${pRisk.color}08` }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 p-3">
        <PRIcon className="w-4 h-4 flex-shrink-0" style={{ color: pRisk.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: pRisk.color }}>{pRisk.label}</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400">Score {summary.avgScore}/100</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {summary.scanned} scanned · {summary.safe} safe · {summary.warning} warnings · {summary.danger} critical
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRescan}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
            title="Re-scan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {flaggedTokens.length > 0 && (
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-3 pb-2">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${summary.avgScore}%`,
              backgroundColor: pRisk.color,
            }}
          />
        </div>
      </div>

      {/* Expanded flagged token list */}
      {expanded && flaggedTokens.length > 0 && (
        <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
          {flaggedTokens.map((t, i) => {
            const r = riskResults[t.contractAddress?.toLowerCase()];
            if (!r) return null;
            const cfg = RISK_CONFIG[r.riskLevel];
            const CfgIcon = cfg.Icon;
            return (
              <div key={i} className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <CfgIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} />
                  <span className="text-sm font-semibold">{t.symbol}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="ml-auto text-xs text-gray-500">Score {r.score}/100</span>
                </div>
                {r.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.flags.map((flag, fi) => (
                      <span key={fi} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const { address: walletAddress, provider, isConnected, connectAuto, connecting } = useWallet();
  const [portfolio, setPortfolio] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalChange, setTotalChange] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('balance');
  const [pnlRange, setPnlRange] = useState<PnlRange>('1M');
  const [historyRange, setHistoryRange] = useState<HistoryRange>('1M');
  const [riskResults, setRiskResults] = useState<Record<string, TokenRisk>>({});
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskExpanded, setRiskExpanded] = useState(false);
  const [riskDismissed, setRiskDismissed] = useState(false);

  const historyData = [
    { label: 'Jan', value: 8200 },
    { label: 'Feb', value: 9100 },
    { label: 'Mar', value: 7800 },
    { label: 'Apr', value: 11200 },
    { label: 'May', value: 13400 },
    { label: 'Jun', value: 12100 },
    { label: 'Jul', value: 14800 },
  ];

  const pnlData = portfolio.map((t, i) => ({
    symbol: t.symbol,
    name: t.name,
    unrealized: t.valueUsd * (t.change24h / 100),
    realized: t.valueUsd * ((t.change24h + Math.random() * 10 - 5) / 100),
    pct: t.change24h,
    valueUsd: t.valueUsd,
    color: COLORS[i % COLORS.length],
  }));

  const totalUnrealized = pnlData.reduce((s, t) => s + t.unrealized, 0);
  const totalRealized = pnlData.reduce((s, t) => s + t.realized, 0);

  useEffect(() => {
    if (walletAddress) fetchPortfolio(walletAddress);
  }, [walletAddress]);

  const runRiskScan = async (tokens: Token[]) => {
    const scannable = tokens.filter(t => t.contractAddress && t.contractAddress !== 'native');
    if (scannable.length === 0) return;
    setRiskLoading(true);
    setRiskDismissed(false);
    try {
      const res = await fetch('/api/portfolio-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: scannable, chainId: '1' }),
      });
      const data = await res.json();
      if (data.results) setRiskResults(data.results);
      if (data.summary) setRiskSummary(data.summary);
    } catch {
      // silent fail
    } finally {
      setRiskLoading(false);
    }
  };

  const fetchPortfolio = async (address: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio?address=${address}`);
      const data = await res.json();
      if (data.portfolio) {
        setPortfolio(data.portfolio);
        setTotalValue(data.totalValue || 0);
        setTotalChange(data.totalChange || 0);
        setTokenCount(data.tokenCount || 0);
        // Auto-run security scan after portfolio loads
        runRiskScan(data.portfolio);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'balance', label: 'Balance', icon: PieChart },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'unrealized', label: 'Unrealized PnL', icon: TrendingUp },
    { id: 'pnl', label: 'Profit & Loss', icon: DollarSign },
  ];

  const HIST_RANGES: HistoryRange[] = ['1D', '1W', '1M', '3M', '1Y', 'All'];
  const PNL_RANGES: PnlRange[] = ['1W', '2W', '3W', '1M', '3M', 'All'];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-8">
      <div className="fixed top-0 w-full z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center px-4 h-14 gap-3">
          <button onClick={() => router.push('/dashboard')} className="hover:bg-white/10 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <PieChart className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="font-heading font-bold">Portfolio</h1>
          {walletAddress && (
            <button
              onClick={() => fetchPortfolio(walletAddress)}
              className="ml-auto hover:bg-white/10 p-2 rounded-lg"
            >
              <RotateCcw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="pt-20 px-4 max-w-2xl mx-auto">
        {!walletAddress ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#0A1EFF]/20">
              <Wallet className="w-10 h-10 text-[#0A1EFF]" />
            </div>
            <h2 className="text-2xl font-heading font-bold mb-2">Track Your Portfolio</h2>
            <p className="text-gray-400 text-sm mb-4 max-w-xs mx-auto">Create or import a wallet in the Wallet tab to see real-time holdings, P&L, and performance analytics across all chains.</p>
            <button
              onClick={() => router.push('/dashboard/wallet-page')}
              className="bg-[#0A1EFF] hover:bg-[#0818CC] px-8 py-3 rounded-xl font-semibold transition-all"
            >
              Open STEINZ Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl p-6 border border-[#0A1EFF]/20 bg-gradient-to-br from-[#0A1EFF]/[0.06] to-[#7C3AED]/[0.04]">
              <div className="text-xs text-gray-400 mb-1">Total Portfolio Value</div>
              <div className="text-3xl font-heading font-bold mb-2 font-mono">
                {fmtUsd(totalValue)}
              </div>
              <div className="flex items-center gap-2">
                {totalChange >= 0
                  ? <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
                  : <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />
                }
                <span className="text-sm font-semibold" style={{ color: pctColor(totalChange) }}>
                  {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
                </span>
                <span className="text-xs text-gray-500">24h</span>
                <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                  <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.02] text-center">
                <div className="text-lg font-bold">{tokenCount}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Assets</div>
              </div>
              <div className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.02] text-center">
                <div className="text-lg font-bold" style={{ color: '#10B981' }}>
                  {portfolio.filter(t => t.change24h >= 0).length}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Gainers</div>
              </div>
              <div className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.02] text-center">
                <div className="text-lg font-bold" style={{ color: '#EF4444' }}>
                  {portfolio.filter(t => t.change24h < 0).length}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Losers</div>
              </div>
            </div>

            <div className="flex gap-0 border border-white/[0.06] bg-white/[0.02] rounded-xl p-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                      activeTab === tab.id
                        ? 'bg-[#0A1EFF] text-white'
                        : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'balance' && (
              <div className="space-y-4">
                {/* Security Risk Banner */}
                {!riskDismissed && (
                  <RiskBanner
                    summary={riskSummary}
                    riskResults={riskResults}
                    portfolio={portfolio}
                    loading={riskLoading}
                    expanded={riskExpanded}
                    onToggle={() => setRiskExpanded(p => !p)}
                    onDismiss={() => setRiskDismissed(true)}
                    onRescan={() => runRiskScan(portfolio)}
                  />
                )}

                {portfolio.length > 0 && totalValue > 0 && (
                  <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-[#0A1EFF]" />
                      <span className="font-bold text-sm">Allocation</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
                      {portfolio.filter(t => t.valueUsd > 0).map((token, i) => {
                        const pct = (token.valueUsd / totalValue) * 100;
                        return (
                          <div
                            key={i}
                            className="h-full"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length], minWidth: pct > 0 ? '3px' : '0' }}
                            title={`${token.symbol}: ${pct.toFixed(1)}%`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {portfolio.filter(t => t.valueUsd > 0).slice(0, 6).map((token, i) => {
                        const pct = (token.valueUsd / totalValue) * 100;
                        return (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            {token.symbol} {pct.toFixed(1)}%
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-white/[0.06] bg-white/[0.02]">
                    <BarChart3 className="w-4 h-4 text-[#0A1EFF]" />
                    <span className="font-bold text-sm">Holdings</span>
                    <span className="ml-auto text-xs text-gray-500">{portfolio.length} tokens</span>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-6 h-6 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
                    </div>
                  ) : portfolio.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">No tokens found</div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {portfolio.map((token, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                          <TokenLogo symbol={token.symbol} logo={token.logo} fallbackColor={COLORS[i % COLORS.length]} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold">{token.symbol}</span>
                              <RiskBadge risk={riskResults[token.contractAddress?.toLowerCase()]} />
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">{token.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono font-semibold">{fmtUsd(token.valueUsd)}</div>
                            <div className="text-[10px] text-gray-500">{parseFloat(token.balance).toFixed(4)} {token.symbol}</div>
                          </div>
                          <div className="w-14 text-right">
                            {token.change24h !== 0 && (
                              <div className="flex items-center justify-end gap-0.5">
                                {token.change24h >= 0
                                  ? <TrendingUp className="w-3 h-3" style={{ color: pctColor(token.change24h) }} />
                                  : <TrendingDown className="w-3 h-3" style={{ color: pctColor(token.change24h) }} />
                                }
                                <span className="text-xs font-semibold" style={{ color: pctColor(token.change24h) }}>
                                  {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <a
                    href={provider === 'phantom' ? `https://solscan.io/account/${walletAddress}` : `https://etherscan.io/address/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl p-3 border border-white/[0.06] text-center text-xs text-gray-400 hover:text-[#0A1EFF] transition-colors flex items-center justify-center gap-2"
                  >
                    View on Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => router.push('/dashboard/dna-analyzer')}
                    className="flex-1 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl p-3 text-center text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    Analyze DNA <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-x-auto">
                  {HIST_RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setHistoryRange(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        historyRange === r ? 'bg-[#0A1EFF] text-white' : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Portfolio Value ({historyRange})</div>
                      <div className="text-xl font-bold font-mono">{fmtUsd(totalValue)}</div>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: pctColor(totalChange) }}>
                      {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
                    </span>
                  </div>

                  <div className="h-32 flex items-end gap-1.5">
                    {historyData.map((d, i) => {
                      const maxVal = Math.max(...historyData.map(x => x.value));
                      const pct = (d.value / maxVal) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm transition-all"
                            style={{ height: `${pct}%`, backgroundColor: '#0A1EFF', minHeight: '4px', opacity: 0.5 + (i / historyData.length) * 0.5 }}
                          />
                          <span className="text-[9px] text-gray-500">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-white/[0.06] bg-white/[0.02]">
                    <Clock className="w-4 h-4 text-[#0A1EFF]" />
                    <span className="font-bold text-sm">Historical Snapshots</span>
                    <button className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                      <Download className="w-3 h-3" /> Export
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {historyData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                        <div className="text-sm text-gray-400">{d.label} 2026</div>
                        <div className="font-mono text-sm font-semibold">{fmtUsd(d.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'unrealized' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                    <div className="text-xs text-gray-500 mb-1">Total Unrealized</div>
                    <div className="text-lg font-bold font-mono" style={{ color: pctColor(totalUnrealized) }}>
                      {totalUnrealized >= 0 ? '+' : ''}{fmtUsd(totalUnrealized)}
                    </div>
                  </div>
                  <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                    <div className="text-xs text-gray-500 mb-1">Open Positions</div>
                    <div className="text-lg font-bold">{portfolio.length}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-white/[0.06] bg-white/[0.02]">
                    <TrendingUp className="w-4 h-4 text-[#0A1EFF]" />
                    <span className="font-bold text-sm">Unrealized PnL by Token</span>
                    <button className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                      <Download className="w-3 h-3" /> Export
                    </button>
                  </div>
                  {pnlData.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">Connect wallet to see PnL</div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {pnlData.sort((a, b) => Math.abs(b.unrealized) - Math.abs(a.unrealized)).map((t, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                          <TokenLogo symbol={t.symbol} fallbackColor={t.color} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">{t.symbol}</div>
                            <div className="text-[10px] text-gray-500">{fmtUsd(t.valueUsd)} position</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono font-semibold" style={{ color: pctColor(t.unrealized) }}>
                              {t.unrealized >= 0 ? '+' : ''}{fmtUsd(t.unrealized)}
                            </div>
                            <div className="text-[10px]" style={{ color: pctColor(t.pct) }}>
                              {t.pct >= 0 ? '+' : ''}{t.pct.toFixed(1)}%
                            </div>
                          </div>
                          <div className="w-16">
                            <MiniBar data={[t.unrealized * 0.3, t.unrealized * 0.6, t.unrealized * 0.8, t.unrealized]} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pnl' && (
              <div className="space-y-4">
                <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-x-auto">
                  {PNL_RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setPnlRange(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        pnlRange === r ? 'bg-[#0A1EFF] text-white' : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                    <div className="text-xs text-gray-500 mb-1">Realized PnL ({pnlRange})</div>
                    <div className="text-lg font-bold font-mono" style={{ color: pctColor(totalRealized) }}>
                      {totalRealized >= 0 ? '+' : ''}{fmtUsd(totalRealized)}
                    </div>
                  </div>
                  <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                    <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                    <div className="text-lg font-bold" style={{ color: '#10B981' }}>
                      {portfolio.length > 0 ? Math.round((portfolio.filter(t => t.change24h >= 0).length / portfolio.length) * 100) : 0}%
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-white/[0.06] bg-white/[0.02]">
                    <DollarSign className="w-4 h-4 text-[#0A1EFF]" />
                    <span className="font-bold text-sm">Realized P&L Breakdown</span>
                    <button className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                  </div>
                  {pnlData.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">Connect wallet to see P&L data</div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {pnlData.sort((a, b) => Math.abs(b.realized) - Math.abs(a.realized)).map((t, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                          <TokenLogo symbol={t.symbol} fallbackColor={t.color} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">{t.symbol}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <div
                                className="h-1 rounded-full"
                                style={{
                                  width: `${Math.min(Math.abs(t.realized / (totalRealized || 1)) * 100, 100)}%`,
                                  backgroundColor: pctColor(t.realized),
                                  minWidth: '4px',
                                  maxWidth: '80px',
                                }}
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono font-semibold" style={{ color: pctColor(t.realized) }}>
                              {t.realized >= 0 ? '+' : ''}{fmtUsd(t.realized)}
                            </div>
                            <div className="text-[10px] text-gray-500">realized</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
