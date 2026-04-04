'use client';

import { ArrowDownUp, ArrowLeft, ChevronDown, Settings, Zap, Search, X, AlertTriangle, Loader2, RefreshCw, ExternalLink, Info } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', symbol: 'ETH', color: '#627EEA', dex: 'Uniswap V3' },
  { id: 'base', label: 'Base', symbol: 'ETH', color: '#0052FF', dex: 'Aerodrome' },
  { id: 'solana', label: 'Solana', symbol: 'SOL', color: '#9945FF', dex: 'Raydium' },
  { id: 'bsc', label: 'BSC', symbol: 'BNB', color: '#F0B90B', dex: 'PancakeSwap' },
  { id: 'polygon', label: 'Polygon', symbol: 'MATIC', color: '#8247E5', dex: 'QuickSwap' },
  { id: 'avalanche', label: 'AVAX', symbol: 'AVAX', color: '#E84142', dex: 'TraderJoe' },
  { id: 'arbitrum', label: 'Arbitrum', symbol: 'ETH', color: '#28A0F0', dex: 'Camelot' },
];

interface TokenInfo {
  symbol: string;
  name: string;
  color: string;
  decimals: number;
  popular?: boolean;
}

const TOKEN_LIST: TokenInfo[] = [
  { symbol: 'ETH', name: 'Ethereum', color: '#627EEA', decimals: 18, popular: true },
  { symbol: 'SOL', name: 'Solana', color: '#9945FF', decimals: 9, popular: true },
  { symbol: 'USDC', name: 'USD Coin', color: '#2775CA', decimals: 6, popular: true },
  { symbol: 'USDT', name: 'Tether', color: '#26A17B', decimals: 6, popular: true },
  { symbol: 'BNB', name: 'BNB', color: '#F0B90B', decimals: 18, popular: true },
  { symbol: 'MATIC', name: 'Polygon', color: '#8247E5', decimals: 18 },
  { symbol: 'AVAX', name: 'Avalanche', color: '#E84142', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', color: '#F7931A', decimals: 8, popular: true },
  { symbol: 'LINK', name: 'Chainlink', color: '#2A5ADA', decimals: 18 },
  { symbol: 'UNI', name: 'Uniswap', color: '#FF007A', decimals: 18 },
  { symbol: 'ARB', name: 'Arbitrum', color: '#28A0F0', decimals: 18 },
  { symbol: 'OP', name: 'Optimism', color: '#FF0420', decimals: 18 },
  { symbol: 'AAVE', name: 'Aave', color: '#B6509E', decimals: 18 },
  { symbol: 'DAI', name: 'Dai', color: '#F5AC37', decimals: 18 },
  { symbol: 'CRV', name: 'Curve', color: '#F4E532', decimals: 18 },
  { symbol: 'MKR', name: 'Maker', color: '#1AAB9B', decimals: 18 },
  { symbol: 'PEPE', name: 'Pepe', color: '#479C47', decimals: 18 },
  { symbol: 'WIF', name: 'dogwifhat', color: '#B7844F', decimals: 6 },
  { symbol: 'BONK', name: 'Bonk', color: '#F2A900', decimals: 5 },
  { symbol: 'JUP', name: 'Jupiter', color: '#52D5B7', decimals: 6 },
  { symbol: 'RAY', name: 'Raydium', color: '#4F67E4', decimals: 6 },
];

function getTokenInfo(symbol: string): TokenInfo {
  return TOKEN_LIST.find(t => t.symbol === symbol) || { symbol, name: symbol, color: '#6B7280', decimals: 18 };
}

function TokenBadge({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const token = getTokenInfo(symbol);
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shadow-lg"
      style={{ width: size, height: size, minWidth: size, background: `linear-gradient(135deg, ${token.color}, ${token.color}99)`, fontSize: size * 0.36 }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

function TokenSelectModal({ isOpen, onClose, onSelect, exclude }: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
  exclude: string;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = TOKEN_LIST.filter(t =>
    t.symbol !== exclude &&
    (t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  const popular = filtered.filter(t => t.popular);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-[#0f1320] border border-[#1a1f2e] rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h3 className="font-bold text-sm text-white">Select a token</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="p-4 space-y-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 bg-[#060A12] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0A1EFF]/40 transition-colors">
            <Search className="w-4 h-4 text-gray-600" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or paste address"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600 text-white"
            />
          </div>

          {!search && popular.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {popular.map(t => (
                <button
                  key={t.symbol}
                  onClick={() => { onSelect(t.symbol); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#060A12] border border-white/[0.06] rounded-full hover:border-[#0A1EFF]/40 hover:bg-[#0A1EFF]/5 transition-all"
                >
                  <TokenBadge symbol={t.symbol} size={18} />
                  <span className="text-xs font-semibold text-white">{t.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-10">No tokens found</p>
          ) : (
            filtered.map(t => (
              <button
                key={t.symbol}
                onClick={() => { onSelect(t.symbol); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <TokenBadge symbol={t.symbol} size={36} />
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold text-white">{t.symbol}</div>
                  <div className="text-xs text-gray-500">{t.name}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ slippage, setSlippage, isOpen, onClose }: {
  slippage: string;
  setSlippage: (s: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [customSlippage, setCustomSlippage] = useState('');

  if (!isOpen) return null;

  return (
    <div className="bg-[#0f1320] border border-white/[0.06] rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-white">Transaction Settings</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-3.5 h-3.5 text-gray-400" /></button>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-400 font-medium">Slippage Tolerance</span>
          <Info className="w-3 h-3 text-gray-600" />
        </div>
        <div className="flex gap-2">
          {['0.1', '0.5', '1.0', '3.0'].map(s => (
            <button
              key={s}
              onClick={() => { setSlippage(s); setCustomSlippage(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                slippage === s && !customSlippage
                  ? 'bg-[#0A1EFF] text-white shadow-lg shadow-[#0A1EFF]/20'
                  : 'bg-[#060A12] text-gray-400 hover:text-white hover:bg-[#060A12]/80'
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={customSlippage}
          onChange={(e) => {
            setCustomSlippage(e.target.value);
            if (e.target.value) setSlippage(e.target.value);
          }}
          placeholder="Custom"
          className="flex-1 bg-[#060A12] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40 transition-colors text-white placeholder-gray-600"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
      {parseFloat(slippage) > 5 && (
        <div className="flex items-center gap-2 bg-[#F59E0B]/10 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span className="text-xs text-[#F59E0B]">High slippage may result in unfavorable trades</span>
        </div>
      )}
    </div>
  );
}

export default function SwapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [slippage, setSlippage] = useState('0.5');
  const [chain, setChain] = useState('ethereum');
  const [showSettings, setShowSettings] = useState(false);
  const [showTokenSelect, setShowTokenSelect] = useState<'from' | 'to' | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [swapRotate, setSwapRotate] = useState(0);
  const quoteTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const symbol = searchParams.get('symbol');
    const chainParam = searchParams.get('chain');
    if (chainParam) {
      setChain(chainParam);
      const c = CHAINS.find(ch => ch.id === chainParam);
      if (c) setFromToken(c.symbol);
    }
    if (symbol) {
      setToToken(symbol.toUpperCase());
    }
  }, [searchParams]);

  const activeChain = CHAINS.find(c => c.id === chain) || CHAINS[0];
  const [quoteData, setQuoteData] = useState<any>(null);

  const simulateQuote = useCallback((amount: string, from?: string, to?: string, ch?: string) => {
    const f = from || fromToken;
    const t = to || toToken;
    const c = ch || chain;
    if (!amount || parseFloat(amount) <= 0) {
      setToAmount('');
      setQuoteData(null);
      return;
    }
    setFetchingQuote(true);
    if (quoteTimeout.current) clearTimeout(quoteTimeout.current);
    quoteTimeout.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ from: f, to: t, amount, chain: c, slippage });
        const res = await fetch(`/api/swap?${params}`);
        const data = await res.json();
        if (res.ok) {
          setToAmount(data.toAmount.toString());
          setQuoteData(data);
        }
      } catch {}
      setFetchingQuote(false);
    }, 400);
  }, [fromToken, toToken, chain, slippage]);

  const handleFromAmountChange = (val: string) => {
    setFromAmount(val);
    simulateQuote(val);
  };

  const handleSwapTokens = () => {
    setSwapRotate(prev => prev + 180);
    const tmpToken = fromToken;
    const tmpAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tmpToken);
    setFromAmount(toAmount);
    simulateQuote(toAmount, toToken, tmpToken);
  };

  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    setSwapping(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSwapping(false);
    setFromAmount('');
    setToAmount('');
    setQuoteData(null);
  };

  const estimatedGas = quoteData ? `$${quoteData.gasEstimateUsd.toFixed(2)}` : chain === 'solana' ? '$0.001' : chain === 'base' ? '$0.02' : '$2.40';
  const priceImpact = quoteData ? quoteData.priceImpact : '0.01';
  const hasQuote = fromAmount && toAmount && parseFloat(fromAmount) > 0;
  const rate = hasQuote ? (parseFloat(toAmount) / parseFloat(fromAmount)) : 0;

  return (
    <div className="min-h-screen bg-[#060A12] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#0A1EFF]/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 pt-6 sm:pt-12 pb-20 min-h-screen">
        <div className="w-full max-w-[460px]">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-lg font-heading font-bold text-white">Swap</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-[#0A1EFF]/20 text-[#0A1EFF]' : 'hover:bg-white/5 text-gray-400'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4">
            {CHAINS.map(c => (
              <button
                key={c.id}
                onClick={() => { setChain(c.id); setFromToken(c.symbol); simulateQuote(fromAmount, c.symbol, toToken, c.id); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  chain === c.id
                    ? 'bg-white/10 text-white border border-[#1a1f2e]'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            ))}
          </div>

          <SettingsPanel slippage={slippage} setSlippage={setSlippage} isOpen={showSettings} onClose={() => setShowSettings(false)} />
          {showSettings && <div className="h-3" />}

          <div className="bg-[#0f1320]/80 backdrop-blur-xl rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl shadow-black/20">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">You pay</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600">Balance: 0.00</span>
                  <button className="text-[10px] text-[#0A1EFF] font-bold hover:text-[#0A1EFF]/80 transition-colors px-1.5 py-0.5 rounded bg-[#0A1EFF]/10">MAX</button>
                  <button className="text-[10px] text-gray-500 font-bold hover:text-gray-400 transition-colors px-1.5 py-0.5 rounded bg-white/5">HALF</button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => handleFromAmountChange(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent text-3xl sm:text-[32px] font-bold focus:outline-none placeholder-gray-700/50 min-w-0 text-white"
                />
                <button
                  onClick={() => setShowTokenSelect('from')}
                  className="flex items-center gap-2 bg-[#060A12] hover:bg-[#0D1117] px-3 py-2 rounded-xl text-sm font-bold border border-white/[0.06] transition-all hover:border-[#1a1f2e] shrink-0 group"
                >
                  <TokenBadge symbol={fromToken} size={24} />
                  <span className="text-white">{fromToken}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                </button>
              </div>
              {fromAmount && quoteData && (
                <div className="text-xs text-gray-500 mt-2">
                  ~${quoteData.fromAmountUsd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}
                </div>
              )}
            </div>

            <div className="relative h-0 z-10">
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
                <button
                  onClick={handleSwapTokens}
                  className="w-10 h-10 bg-[#1a2332] border-[3px] border-[#0A0E1A] rounded-xl flex items-center justify-center hover:bg-[#0A1EFF] transition-all duration-300 group shadow-lg"
                  style={{ transform: `rotate(${swapRotate}deg)`, transition: 'transform 0.3s ease, background-color 0.2s ease' }}
                >
                  <ArrowDownUp className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-[#0D1117]/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">You receive</span>
                <span className="text-xs text-gray-600">Balance: 0.00</span>
              </div>
              <div className="flex items-center gap-3">
                {fetchingQuote ? (
                  <div className="flex-1 flex items-center gap-2.5">
                    <Loader2 className="w-5 h-5 text-[#0A1EFF] animate-spin" />
                    <span className="text-sm text-gray-500">Finding best route...</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={toAmount}
                    readOnly
                    placeholder="0"
                    className="flex-1 bg-transparent text-3xl sm:text-[32px] font-bold focus:outline-none placeholder-gray-700/50 min-w-0 text-white"
                  />
                )}
                <button
                  onClick={() => setShowTokenSelect('to')}
                  className="flex items-center gap-2 bg-[#060A12] hover:bg-[#0D1117] px-3 py-2 rounded-xl text-sm font-bold border border-white/[0.06] transition-all hover:border-[#1a1f2e] shrink-0 group"
                >
                  <TokenBadge symbol={toToken} size={24} />
                  <span className="text-white">{toToken}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                </button>
              </div>
              {toAmount && quoteData && (
                <div className="text-xs text-gray-500 mt-2">
                  ~${quoteData.toAmountUsd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}
                </div>
              )}
            </div>

            {hasQuote && (
              <div className="border-t border-white/[0.04]">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full px-4 sm:px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <RefreshCw className="w-3 h-3" />
                    <span>1 {fromToken} = {rate.toFixed(fromToken === 'ETH' || fromToken === 'WBTC' ? 2 : 6)} {toToken}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
                </button>

                {showDetails && (
                  <div className="px-4 sm:px-5 pb-4 space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Price Impact</span>
                      <span className={`font-medium ${parseFloat(priceImpact) < 1 ? 'text-green-400' : parseFloat(priceImpact) < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {priceImpact}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Slippage</span>
                      <span className="text-gray-300">{slippage}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Minimum received</span>
                      <span className="text-gray-300">
                        {quoteData ? quoteData.minReceived : (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Network fee</span>
                      <span className="text-gray-300">{estimatedGas}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Route</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeChain.color }} />
                        <span className="font-medium" style={{ color: activeChain.color }}>{activeChain.dex}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3">
            <button
              onClick={handleSwap}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0 || swapping || fetchingQuote}
              className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                fromAmount && parseFloat(fromAmount) > 0 && !swapping && !fetchingQuote
                  ? 'bg-[#0A1EFF] hover:bg-[#0918CC] active:scale-[0.98] text-white shadow-lg shadow-[#0A1EFF]/20'
                  : 'bg-[#0f1320] text-gray-600 cursor-not-allowed border border-white/[0.04]'
              }`}
            >
              {swapping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Swapping...
                </>
              ) : fetchingQuote ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding route...
                </>
              ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
                'Enter an amount'
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Swap
                </>
              )}
            </button>
          </div>

          {hasQuote && (
            <div className="mt-3 bg-[#0f1320]/60 rounded-2xl border border-white/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-[#0A1EFF]" />
                <span className="text-xs text-gray-400 font-medium">Order routing</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TokenBadge symbol={fromToken} size={28} />
                  <div>
                    <div className="text-sm font-bold text-white">{fromToken}</div>
                    <div className="text-[10px] text-gray-500">{fromAmount}</div>
                  </div>
                </div>

                <div className="flex-1 mx-4 flex items-center">
                  <div className="flex-1 border-t border-dashed border-[#1a1f2e]" />
                  <div className="mx-2 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/[0.06]" style={{ backgroundColor: activeChain.color + '15', color: activeChain.color }}>
                    {activeChain.dex}
                  </div>
                  <div className="flex-1 border-t border-dashed border-[#1a1f2e]" />
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{toToken}</div>
                    <div className="text-[10px] text-gray-500">{toAmount}</div>
                  </div>
                  <TokenBadge symbol={toToken} size={28} />
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-1.5 text-gray-600">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeChain.color }} />
            <span className="text-[11px]">Powered by {activeChain.dex}</span>
          </div>
        </div>
      </div>

      <TokenSelectModal
        isOpen={showTokenSelect !== null}
        onClose={() => setShowTokenSelect(null)}
        onSelect={(symbol) => {
          if (showTokenSelect === 'from') {
            if (symbol === toToken) setToToken(fromToken);
            setFromToken(symbol);
            simulateQuote(fromAmount, symbol);
          } else {
            if (symbol === fromToken) setFromToken(toToken);
            setToToken(symbol);
            simulateQuote(fromAmount, undefined, symbol);
          }
        }}
        exclude={showTokenSelect === 'from' ? toToken : fromToken}
      />
    </div>
  );
}
