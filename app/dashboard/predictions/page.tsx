'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Target, Clock, Users, TrendingUp, DollarSign,
  BarChart3, Filter, ChevronDown, CheckCircle, XCircle,
  AlertTriangle, Zap, Trophy, X
} from 'lucide-react';
import Link from 'next/link';

interface Prediction {
  id: string;
  category: 'market_cap' | 'price' | 'volume' | 'launch' | 'holder';
  question: string;
  tokenName: string;
  tokenSymbol: string;
  tokenIcon: string;
  chain: string;
  currentPrice: number;
  currentMcap: number;
  targetValue: number;
  targetLabel: string;
  progress: number;
  priceChange24h: number;
  volume24h: number;
  closeDate: string;
  totalPool: number;
  yesPool: number;
  noPool: number;
  yesPercent: number;
  noPercent: number;
  totalPredictors: number;
  status: 'active' | 'resolved';
  outcome?: 'yes' | 'no';
  chartSymbol: string;
  chartPairAddress?: string;
  chartChainId?: string;
  resolver: string;
  createdAt: string;
}

interface ApiResponse {
  predictions: Prediction[];
  stats: {
    activePredictions: number;
    totalPoolVolume: number;
    resolvedCount: number;
  };
}

interface UserPrediction {
  side: 'yes' | 'no';
  amount: number;
  potentialPayout: number;
}

type Tab = 'all' | 'active' | 'my_predictions' | 'resolved' | 'high_volume';
type CategoryFilter = 'all' | 'market_cap' | 'price' | 'volume' | 'launch' | 'holder';
type ChainFilter = 'all' | 'solana' | 'ethereum' | 'bsc';
type PoolFilter = 'all' | '1k' | '5k' | '10k' | '50k';
type ClosingFilter = 'all' | '24h' | '7d' | '30d';
type SortOption = 'pool' | 'predictors' | 'closing' | 'newest';

const TABS: { id: Tab; label: string; icon: typeof Target }[] = [
  { id: 'all', label: 'All', icon: BarChart3 },
  { id: 'active', label: 'Active', icon: Zap },
  { id: 'my_predictions', label: 'My Predictions', icon: Trophy },
  { id: 'resolved', label: 'Resolved', icon: CheckCircle },
  { id: 'high_volume', label: 'High Volume', icon: TrendingUp },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  market_cap: { bg: 'bg-[#7C3AED]/20', text: 'text-[#7C3AED]' },
  price: { bg: 'bg-[#FF6B35]/20', text: 'text-[#FF6B35]' },
  volume: { bg: 'bg-[#00E5FF]/20', text: 'text-[#00E5FF]' },
  launch: { bg: 'bg-[#10B981]/20', text: 'text-[#10B981]' },
  holder: { bg: 'bg-[#F59E0B]/20', text: 'text-[#F59E0B]' },
};

const CATEGORY_LABELS: Record<string, string> = {
  market_cap: 'Market Cap',
  price: 'Price',
  volume: 'Volume',
  launch: 'Launch',
  holder: 'Holder',
};

function useCountdown(closeDate: string) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'critical'>('normal');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const end = new Date(closeDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Closed');
        setUrgency('critical');
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }

      if (diff < 3600000) setUrgency('critical');
      else if (diff < 86400000) setUrgency('warning');
      else setUrgency('normal');
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [closeDate]);

  return { timeLeft, urgency };
}

function CountdownBadge({ closeDate }: { closeDate: string }) {
  const { timeLeft, urgency } = useCountdown(closeDate);
  const color = urgency === 'critical' ? 'text-[#EF4444]' : urgency === 'warning' ? 'text-[#F59E0B]' : 'text-gray-400';
  const bgColor = urgency === 'critical' ? 'bg-[#EF4444]/10' : urgency === 'warning' ? 'bg-[#F59E0B]/10' : 'bg-white/5';

  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${color} ${bgColor}`}>
      <Clock className="w-3 h-3" />
      {timeLeft}
    </span>
  );
}

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(n: number): string {
  if (n >= 1) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
}

function TokenIcon({ src, symbol }: { src: string; symbol: string }) {
  const [error, setError] = useState(false);
  if (error || !src) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#7C3AED] flex items-center justify-center text-xs font-bold flex-shrink-0">
        {symbol?.slice(0, 2) || '?'}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={symbol}
      className="w-8 h-8 rounded-full flex-shrink-0 bg-[#111827]"
      onError={() => setError(true)}
    />
  );
}

function DropdownFilter({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#111827] border border-white/10 text-gray-300 hover:border-white/20 transition-colors whitespace-nowrap"
      >
        {selected?.label || label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#111827] border border-white/10 rounded-lg shadow-xl min-w-[140px] py-1 max-h-60 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 transition-colors ${
                  value === opt.value ? 'text-[#00E5FF] font-semibold' : 'text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PredictionModal({
  prediction,
  side,
  onClose,
  onConfirm,
}: {
  prediction: Prediction;
  side: 'yes' | 'no';
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<string>('');
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const platformFee = 0.03;
  const netAmount = numAmount * (1 - platformFee);
  const sidePool = side === 'yes' ? prediction.yesPool : prediction.noPool;
  const potentialPayout = sidePool > 0 ? (netAmount * prediction.totalPool) / sidePool : 0;
  const profit = potentialPayout - numAmount;
  const profitPercent = numAmount > 0 ? ((profit / numAmount) * 100) : 0;
  const estimatedGas = 2.50;

  const riskLevel = side === 'yes'
    ? prediction.yesPercent > 70 ? 'Low' : prediction.yesPercent > 40 ? 'Medium' : 'High'
    : prediction.noPercent > 70 ? 'Low' : prediction.noPercent > 40 ? 'Medium' : 'High';
  const riskColor = riskLevel === 'Low' ? '#10B981' : riskLevel === 'Medium' ? '#F59E0B' : '#EF4444';

  const chartUrl = prediction.chartPairAddress && prediction.chartChainId
    ? `https://dexscreener.com/${prediction.chartChainId}/${prediction.chartPairAddress}?embed=1&theme=dark&trades=0&info=0`
    : null;

  const handleConfirm = async () => {
    if (numAmount < 10) return;
    setConfirming(true);
    try {
      onConfirm(numAmount);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch {
      setConfirming(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
        <div className="bg-[#0A0E1A] border border-white/10 rounded-2xl w-full max-w-md p-8 text-center mx-4" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#10B981]/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-[#10B981]" />
          </div>
          <h3 className="text-lg font-bold mb-2">Prediction Placed!</h3>
          <p className="text-sm text-gray-400">
            You predicted {side.toUpperCase()} with ${numAmount.toFixed(2)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#0A0E1A] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-0 sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#0A0E1A] border-b border-white/10 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
              side === 'yes' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
            }`}>
              {side === 'yes' ? '✓' : '✗'}
            </div>
            <div>
              <h3 className="text-sm font-bold">Predict {side.toUpperCase()}</h3>
              <p className="text-[10px] text-gray-500">{prediction.tokenSymbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="glass rounded-xl p-3 border border-white/10">
            <p className="text-sm font-semibold">{prediction.question}</p>
          </div>

          {chartUrl && (
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="w-full" style={{ height: '180px' }}>
                <iframe
                  src={chartUrl}
                  className="w-full h-full border-0"
                  title="Chart"
                  allow="clipboard-write"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 mb-2 block">Amount (USD)</label>
            <div className="bg-[#111827] border border-white/10 rounded-xl px-4 py-3">
              <input
                type="number"
                min="10"
                step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount ($10 min)"
                className="bg-transparent focus:outline-none text-lg w-full text-white placeholder-gray-600 font-mono"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[10, 50, 100, 500].map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    amount === String(v)
                      ? 'border-[#00E5FF]/50 bg-[#00E5FF]/10 text-[#00E5FF]'
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {numAmount >= 10 && (
            <div className="glass rounded-xl p-4 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-gray-300">Payout Calculator</h4>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Your prediction</span>
                  <span className="font-semibold">${numAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Platform fee (3%)</span>
                  <span className="text-gray-500">-${(numAmount * platformFee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Net amount</span>
                  <span className="font-semibold">${netAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Estimated gas</span>
                  <span className="text-gray-500">~${estimatedGas.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className={side === 'yes' ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                      If {side.toUpperCase()} wins
                    </span>
                    <span className="font-bold text-[#FFD700]">
                      ${potentialPayout.toFixed(2)} ({profitPercent > 0 ? '+' : ''}{profitPercent.toFixed(0)}% profit)
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-500">
                      If {side === 'yes' ? 'NO' : 'YES'} wins
                    </span>
                    <span className="text-[#EF4444] font-semibold">-${numAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: riskColor }} />
                <span className="text-[10px] font-semibold" style={{ color: riskColor }}>
                  Risk: {riskLevel}
                </span>
                <div className="flex-1 bg-white/10 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: riskLevel === 'Low' ? '30%' : riskLevel === 'Medium' ? '60%' : '90%',
                      backgroundColor: riskColor,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={numAmount < 10 || confirming}
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
              numAmount >= 10
                ? side === 'yes'
                  ? 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-lg shadow-[#10B981]/20 hover:shadow-[#10B981]/40'
                  : 'bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white shadow-lg shadow-[#EF4444]/20 hover:shadow-[#EF4444]/40'
                : 'bg-[#111827] text-gray-500 cursor-not-allowed'
            }`}
          >
            {confirming ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Confirming...
              </span>
            ) : numAmount >= 10 ? (
              `Confirm Prediction - $${numAmount.toFixed(2)}`
            ) : (
              'Enter amount ($10 min)'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PredictionCard({
  prediction,
  userPrediction,
  onPredict,
}: {
  prediction: Prediction;
  userPrediction?: UserPrediction;
  onPredict: (side: 'yes' | 'no') => void;
}) {
  const catColor = CATEGORY_COLORS[prediction.category] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
  const chartUrl = prediction.chartPairAddress && prediction.chartChainId
    ? `https://dexscreener.com/${prediction.chartChainId}/${prediction.chartPairAddress}?embed=1&theme=dark&trades=0&info=0`
    : null;

  const cgChartUrl: string | null = null;

  return (
    <div className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${catColor.bg} ${catColor.text}`}>
            {CATEGORY_LABELS[prediction.category] || prediction.category}
          </span>
          <span className="text-[10px] text-gray-500 uppercase">{prediction.chain}</span>
        </div>
        <CountdownBadge closeDate={prediction.closeDate} />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <TokenIcon src={prediction.tokenIcon} symbol={prediction.tokenSymbol} />
        <h3 className="text-sm font-bold flex-1">{prediction.question}</h3>
      </div>

      {chartUrl ? (
        <div className="rounded-lg overflow-hidden border border-white/5 mb-3" style={{ height: '160px' }}>
          <iframe
            src={chartUrl}
            className="w-full h-full border-0"
            title={`${prediction.tokenSymbol} chart`}
            allow="clipboard-write"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      ) : (
        <div className="glass rounded-lg p-3 mb-3 border border-white/5">
          {cgChartUrl && (
            <div className="mb-2 opacity-60">
              <img src={cgChartUrl} alt="sparkline" className="w-full h-10 object-contain" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-500">Current Price</div>
              <div className="text-sm font-bold font-mono">{formatPrice(prediction.currentPrice)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500">24h Change</div>
              <div className={`text-sm font-bold ${prediction.priceChange24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {prediction.priceChange24h >= 0 ? '+' : ''}{prediction.priceChange24h.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2">
        <span>Current: {formatPrice(prediction.currentPrice)}</span>
        <span>Target: {prediction.targetLabel}</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1.5 mb-3">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FFD700] transition-all"
          style={{ width: `${Math.min(prediction.progress, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
        <span>Total Pool: {formatUsd(prediction.totalPool)}</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {prediction.totalPredictors}</span>
      </div>
      <div className="flex rounded-full h-5 overflow-hidden mb-1">
        <div
          className="bg-[#10B981] flex items-center justify-center text-[10px] font-bold transition-all"
          style={{ width: `${prediction.yesPercent}%` }}
        >
          {prediction.yesPercent > 15 && `YES ${prediction.yesPercent}%`}
        </div>
        <div
          className="bg-[#EF4444] flex items-center justify-center text-[10px] font-bold transition-all"
          style={{ width: `${prediction.noPercent}%` }}
        >
          {prediction.noPercent > 15 && `NO ${prediction.noPercent}%`}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-3">
        <span>YES: {formatUsd(prediction.yesPool)}</span>
        <span>NO: {formatUsd(prediction.noPool)}</span>
      </div>

      {prediction.status === 'resolved' && prediction.outcome ? (
        <div className={`text-center py-2.5 rounded-lg text-xs font-bold ${
          prediction.outcome === 'yes'
            ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
            : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
        }`}>
          <span className="flex items-center justify-center gap-1.5">
            {prediction.outcome === 'yes' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            Resolved: {prediction.outcome.toUpperCase()}
          </span>
        </div>
      ) : userPrediction ? (
        <div className={`text-center py-2.5 rounded-lg text-xs font-semibold border ${
          userPrediction.side === 'yes'
            ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
            : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
        }`}>
          <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5">Your Prediction</div>
          {userPrediction.side.toUpperCase()} — ${userPrediction.amount.toFixed(2)}
          <span className="text-gray-400 ml-1">(Payout: ${userPrediction.potentialPayout.toFixed(2)})</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onPredict('yes')}
            className="py-2.5 rounded-lg text-xs font-bold border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10 transition-all shadow-sm hover:shadow-[#10B981]/20 hover:shadow-lg"
          >
            Predict YES
          </button>
          <button
            onClick={() => onPredict('no')}
            className="py-2.5 rounded-lg text-xs font-bold border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 transition-all shadow-sm hover:shadow-[#EF4444]/20 hover:shadow-lg"
          >
            Predict NO
          </button>
        </div>
      )}
    </div>
  );
}

export default function PredictionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [chainFilter, setChainFilter] = useState<ChainFilter>('all');
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('all');
  const [closingFilter, setClosingFilter] = useState<ClosingFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('pool');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState({ activePredictions: 0, totalPoolVolume: 0, resolvedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [userPredictions, setUserPredictions] = useState<Record<string, UserPrediction>>({});
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [predictionSide, setPredictionSide] = useState<'yes' | 'no'>('yes');

  const fetchPredictions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab === 'active') params.set('tab', 'active');
      else if (activeTab === 'resolved') params.set('tab', 'resolved');
      else if (activeTab === 'high_volume') params.set('tab', 'high_volume');
      else params.set('tab', 'all');
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (chainFilter !== 'all') params.set('chain', chainFilter);
      if (sortOption) params.set('sort', sortOption);
      if (closingFilter !== 'all') params.set('closing', closingFilter);

      const res = await fetch(`/api/predictions?${params.toString()}`);
      const data: ApiResponse = await res.json();
      setPredictions(data.predictions || []);
      setStats(data.stats || { activePredictions: 0, totalPoolVolume: 0, resolvedCount: 0 });
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, categoryFilter, chainFilter, sortOption, closingFilter]);

  useEffect(() => {
    setLoading(true);
    fetchPredictions();
  }, [fetchPredictions]);

  useEffect(() => {
    const interval = setInterval(fetchPredictions, 15000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  const handleOpenModal = (prediction: Prediction, side: 'yes' | 'no') => {
    setSelectedPrediction(prediction);
    setPredictionSide(side);
  };

  const handleConfirmPrediction = async (amount: number) => {
    if (!selectedPrediction) return;

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictionId: selectedPrediction.id,
          side: predictionSide,
          amount,
        }),
      });
      const data = await res.json();
      if (data.prediction) {
        setPredictions(prev =>
          prev.map(p => p.id === data.prediction.id ? data.prediction : p)
        );
      }
      setUserPredictions(prev => ({
        ...prev,
        [selectedPrediction.id]: {
          side: predictionSide,
          amount,
          potentialPayout: data.payout?.potentialPayout || amount,
        },
      }));
    } catch {}
  };

  const filteredPredictions = useMemo(() => {
    let filtered = [...predictions];

    if (activeTab === 'my_predictions') {
      filtered = filtered.filter(p => userPredictions[p.id]);
    }

    if (poolFilter !== 'all') {
      const minPool = poolFilter === '1k' ? 1000 : poolFilter === '5k' ? 5000 : poolFilter === '10k' ? 10000 : 50000;
      filtered = filtered.filter(p => p.totalPool >= minPool);
    }

    return filtered;
  }, [predictions, activeTab, poolFilter, userPredictions]);

  const userTotalWagered = useMemo(() =>
    Object.values(userPredictions).reduce((sum, p) => sum + p.amount, 0),
    [userPredictions]
  );

  const userPotentialWinnings = useMemo(() =>
    Object.values(userPredictions).reduce((sum, p) => sum + p.potentialPayout, 0),
    [userPredictions]
  );

  const userActiveCount = Object.keys(userPredictions).length;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Target className="w-5 h-5 text-[#FF6B35]" />
          <h1 className="text-xl font-heading font-bold">Predictions Market</h1>
          <span className="ml-auto text-[10px] text-gray-500 font-mono">{stats.activePredictions} active</span>
        </div>
        <p className="text-gray-400 text-xs mb-4">Predict crypto outcomes. Winners split the pool.</p>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {[
            { label: 'Active', value: stats.activePredictions, icon: Zap, color: '#FF6B35' },
            { label: 'Total Pool', value: formatUsd(stats.totalPoolVolume), icon: DollarSign, color: '#00E5FF' },
            { label: 'Your Active', value: userActiveCount, icon: Target, color: '#7C3AED' },
            { label: 'Wagered', value: formatUsd(userTotalWagered), icon: BarChart3, color: '#F59E0B' },
            { label: 'Potential', value: formatUsd(userPotentialWinnings), icon: Trophy, color: '#FFD700' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="glass rounded-xl p-3 border border-white/10 min-w-[110px] flex-shrink-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                  <span className="text-[10px] text-gray-400">{stat.label}</span>
                </div>
                <div className="text-sm font-bold">{stat.value}</div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFD700] text-white border-transparent shadow-lg'
                    : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20 bg-white/5'
                }`}
                style={isActive ? { boxShadow: '0 0 12px #FF6B3540' } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          <div className="flex items-center gap-1 text-gray-500 mr-1">
            <Filter className="w-3 h-3" />
          </div>
          <DropdownFilter
            label="Category"
            value={categoryFilter}
            options={[
              { value: 'all', label: 'All Categories' },
              { value: 'market_cap', label: 'Market Cap' },
              { value: 'price', label: 'Price' },
              { value: 'volume', label: 'Volume' },
              { value: 'launch', label: 'Launch' },
              { value: 'holder', label: 'Holder' },
            ]}
            onChange={v => setCategoryFilter(v as CategoryFilter)}
          />
          <DropdownFilter
            label="Chain"
            value={chainFilter}
            options={[
              { value: 'all', label: 'All Chains' },
              { value: 'solana', label: 'Solana' },
              { value: 'ethereum', label: 'Ethereum' },
              { value: 'bsc', label: 'BSC' },
            ]}
            onChange={v => setChainFilter(v as ChainFilter)}
          />
          <DropdownFilter
            label="Pool Size"
            value={poolFilter}
            options={[
              { value: 'all', label: 'Any Pool' },
              { value: '1k', label: '$1K+' },
              { value: '5k', label: '$5K+' },
              { value: '10k', label: '$10K+' },
              { value: '50k', label: '$50K+' },
            ]}
            onChange={v => setPoolFilter(v as PoolFilter)}
          />
          <DropdownFilter
            label="Closing"
            value={closingFilter}
            options={[
              { value: 'all', label: 'Any Time' },
              { value: '24h', label: '< 24h' },
              { value: '7d', label: '< 7 days' },
              { value: '30d', label: '< 30 days' },
            ]}
            onChange={v => setClosingFilter(v as ClosingFilter)}
          />
          <DropdownFilter
            label="Sort"
            value={sortOption}
            options={[
              { value: 'pool', label: 'Biggest Pool' },
              { value: 'predictors', label: 'Most Predictors' },
              { value: 'closing', label: 'Closing Soon' },
              { value: 'newest', label: 'Newest' },
            ]}
            onChange={v => setSortOption(v as SortOption)}
          />
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#FF6B35]/40 border-t-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-[#FFD700] border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            <p className="text-sm font-semibold mb-1">Loading Predictions...</p>
            <p className="text-xs text-gray-400">Fetching real market data</p>
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="text-center py-16">
            <Target className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-sm font-semibold mb-1">No Predictions Found</p>
            <p className="text-xs text-gray-400">
              {activeTab === 'my_predictions'
                ? 'You haven\'t made any predictions yet.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPredictions.map(pred => (
              <PredictionCard
                key={pred.id}
                prediction={pred}
                userPrediction={userPredictions[pred.id]}
                onPredict={side => handleOpenModal(pred, side)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedPrediction && (
        <PredictionModal
          prediction={selectedPrediction}
          side={predictionSide}
          onClose={() => setSelectedPrediction(null)}
          onConfirm={handleConfirmPrediction}
        />
      )}
    </div>
  );
}