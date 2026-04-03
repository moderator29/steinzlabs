'use client';

import { ArrowLeftRight, ArrowLeft, ChevronDown, Settings, Zap, Search, X, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

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
      className="rounded-full flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, minWidth: size, background: token.color, fontSize: size * 0.38 }}
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
  const all = filtered;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0D1117] border border-white/10 rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-bold text-sm">Select Token</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or symbol"
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder-gray-600"
            />
          </div>

          {!search && popular.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {popular.map(t => (
                <button
                  key={t.symbol}
                  onClick={() => { onSelect(t.symbol); onClose(); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#111827] border border-white/10 rounded-lg hover:border-[#0A1EFF]/30 transition-colors"
                >
                  <TokenBadge symbol={t.symbol} size={18} />
                  <span className="text-[11px] font-semibold">{t.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {all.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-8">No tokens found</p>
          ) : (
            all.map(t => (
              <button
                key={t.symbol}
                onClick={() => { onSelect(t.symbol); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <TokenBadge symbol={t.symbol} size={32} />
                <div className="text-left">
                  <div className="text-xs font-semibold">{t.symbol}</div>
                  <div className="text-[10px] text-gray-500">{t.name}</div>
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
    <div className="bg-[#0D1117] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Slippage Tolerance</span>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-3 h-3" /></button>
      </div>
      <div className="flex gap-2">
        {['0.1', '0.5', '1.0', '3.0'].map(s => (
          <button
            key={s}
            onClick={() => { setSlippage(s); setCustomSlippage(''); }}
            className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all ${
              slippage === s && !customSlippage
                ? 'bg-[#0A1EFF]/20 text-[#0A1EFF] border border-[#0A1EFF]/30'
                : 'bg-[#111827] text-gray-400 border border-white/5 hover:border-white/10'
            }`}
          >
            {s}%
          </button>
        ))}
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
          className="flex-1 bg-[#111827] border border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0A1EFF]/30"
        />
        <span className="text-xs text-gray-500">%</span>
      </div>
      {parseFloat(slippage) > 5 && (
        <div className="flex items-center gap-1.5 text-[#F59E0B]">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-[10px]">High slippage may result in unfavorable trades</span>
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

  const simulateQuote = (amount: string, from?: string, to?: string, ch?: string) => {
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
  };

  const handleFromAmountChange = (val: string) => {
    setFromAmount(val);
    simulateQuote(val);
  };

  const handleSwapTokens = () => {
    const tmpToken = fromToken;
    const tmpAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tmpToken);
    setFromAmount(toAmount);
    simulateQuote(toAmount);
  };

  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    setSwapping(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSwapping(false);
    setFromAmount('');
    setToAmount('');
  };

  const estimatedGas = quoteData ? `~$${quoteData.gasEstimateUsd.toFixed(2)}` : chain === 'solana' ? '~$0.001' : chain === 'base' ? '~$0.02' : '~$2.40';
  const priceImpact = quoteData ? `${quoteData.priceImpact}` : null;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <ArrowLeftRight className="w-5 h-5 text-[#0A1EFF]" />
            <h1 className="text-sm font-heading font-bold">Swap</h1>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-[#0A1EFF]/20 text-[#0A1EFF]' : 'hover:bg-white/10 text-gray-400'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-md mx-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CHAINS.map(c => (
            <button
              key={c.id}
              onClick={() => { setChain(c.id); setFromToken(c.symbol); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border whitespace-nowrap transition-all ${
                chain === c.id
                  ? 'border-opacity-50'
                  : 'border-white/5 opacity-50 hover:opacity-80'
              }`}
              style={chain === c.id ? { backgroundColor: c.color + '15', color: c.color, borderColor: c.color + '40' } : {}}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeChain.color }} />
          <span className="text-[10px] font-semibold" style={{ color: activeChain.color }}>
            Powered by {activeChain.dex}
          </span>
        </div>

        <SettingsPanel slippage={slippage} setSlippage={setSlippage} isOpen={showSettings} onClose={() => setShowSettings(false)} />

        <div className="bg-[#0D1117] rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">You Pay</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500">Balance: 0.00</span>
                <button className="text-[10px] text-[#0A1EFF] font-semibold hover:underline">MAX</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-2xl font-bold focus:outline-none placeholder-gray-700 min-w-0"
              />
              <button
                onClick={() => setShowTokenSelect('from')}
                className="flex items-center gap-2 bg-[#111827] hover:bg-[#1a2332] px-3 py-2.5 rounded-xl text-sm font-semibold border border-white/10 transition-colors shrink-0"
              >
                <TokenBadge symbol={fromToken} size={22} />
                <span>{fromToken}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            {fromAmount && quoteData && (
              <div className="text-[10px] text-gray-500 mt-1.5">
                ~${quoteData.fromAmountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>

          <div className="relative h-0">
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <button
                onClick={handleSwapTokens}
                className="w-9 h-9 bg-[#111827] border-2 border-[#0A0E1A] rounded-xl flex items-center justify-center hover:bg-[#0A1EFF]/20 hover:border-[#0A1EFF]/30 transition-all hover:rotate-180 duration-300 group"
              >
                <ArrowLeftRight className="w-4 h-4 text-gray-400 group-hover:text-[#0A1EFF]" />
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#0B0F19]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">You Receive</span>
              <span className="text-[10px] text-gray-500">Balance: 0.00</span>
            </div>
            <div className="flex items-center gap-3">
              {fetchingQuote ? (
                <div className="flex-1 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-[#0A1EFF] animate-spin" />
                  <span className="text-sm text-gray-500">Fetching quote...</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-2xl font-bold focus:outline-none placeholder-gray-700 min-w-0"
                />
              )}
              <button
                onClick={() => setShowTokenSelect('to')}
                className="flex items-center gap-2 bg-[#111827] hover:bg-[#1a2332] px-3 py-2.5 rounded-xl text-sm font-semibold border border-white/10 transition-colors shrink-0"
              >
                <TokenBadge symbol={toToken} size={22} />
                <span>{toToken}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            {toAmount && quoteData && (
              <div className="text-[10px] text-gray-500 mt-1.5">
                ~${quoteData.toAmountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {fromAmount && toAmount && (
          <div className="bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden">
            <button className="w-full px-4 py-3 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 text-gray-500" />
                <span className="text-gray-400">1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(fromToken === 'ETH' ? 2 : 6)} {toToken}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Price Impact</span>
                <span className="text-green-400">{priceImpact}%</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Slippage Tolerance</span>
                <span className="text-[#F59E0B]">{slippage}%</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Min. Received</span>
                <span>{quoteData ? quoteData.minReceived : (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Network Fee</span>
                <span>{estimatedGas}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Route</span>
                <span style={{ color: activeChain.color }}>{activeChain.dex}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSwap}
          disabled={!fromAmount || parseFloat(fromAmount) <= 0 || swapping || fetchingQuote}
          className={`w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            fromAmount && parseFloat(fromAmount) > 0 && !swapping
              ? 'bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-[#111827] text-gray-500 cursor-not-allowed'
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
              Fetching Quote...
            </>
          ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
            'Enter Amount'
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Swap {fromToken} for {toToken}
            </>
          )}
        </button>

        <div className="bg-[#0D1117] rounded-xl border border-white/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-[#0A1EFF]/10 rounded flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-[#0A1EFF]" />
            </div>
            <span className="text-[10px] text-gray-500 font-semibold">Swap Route</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TokenBadge symbol={fromToken} size={20} />
              <span className="text-[11px] font-semibold">{fromToken}</span>
            </div>
            <div className="flex-1 mx-3 border-t border-dashed border-white/10 relative">
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[8px] font-semibold" style={{ backgroundColor: activeChain.color + '20', color: activeChain.color }}>
                {activeChain.dex}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold">{toToken}</span>
              <TokenBadge symbol={toToken} size={20} />
            </div>
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
          } else {
            if (symbol === fromToken) setFromToken(toToken);
            setToToken(symbol);
          }
          simulateQuote(fromAmount);
        }}
        exclude={showTokenSelect === 'from' ? toToken : fromToken}
      />
    </div>
  );
}
