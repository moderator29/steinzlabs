'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ArrowUpRight, ArrowDownRight,
  Clock, Wallet, ChevronDown, Star, Loader2, ExternalLink, Zap
} from 'lucide-react';
import TradingViewChart, { getTradingViewSymbol } from '@/components/TradingViewChart';

interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  fdv: number;
  high24h: number;
  low24h: number;
  totalSupply: number;
  circulatingSupply: number;
  rank: number;
}

interface DexResult {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  dexUrl: string;
  pairAddress: string;
}

function fmtVol(n: number) {
  if (!n) return '--';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const CHAIN_LABELS: Record<string, string> = {
  ethereum: 'ETH',
  bsc: 'BSC',
  polygon: 'POLY',
  arbitrum: 'ARB',
  optimism: 'OP',
  base: 'BASE',
  avalanche: 'AVAX',
  solana: 'SOL',
  fantom: 'FTM',
  cronos: 'CRO',
  zksync: 'ZK',
};

const POPULAR_TOKENS: TokenInfo[] = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 21000000, circulatingSupply: 19600000, rank: 1 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 120000000, circulatingSupply: 120000000, rank: 2 },
  { id: 'solana', name: 'Solana', symbol: 'SOL', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 580000000, circulatingSupply: 440000000, rank: 5 },
  { id: 'binancecoin', name: 'BNB', symbol: 'BNB', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 145000000, circulatingSupply: 145000000, rank: 4 },
  { id: 'ripple', name: 'XRP', symbol: 'XRP', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 100000000000, circulatingSupply: 55000000000, rank: 6 },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 144000000000, circulatingSupply: 144000000000, rank: 8 },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 45000000000, circulatingSupply: 35000000000, rank: 9 },
  { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 1000000000, circulatingSupply: 609000000, rank: 12 },
  { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 720000000, circulatingSupply: 410000000, rank: 14 },
  { id: 'uniswap', name: 'Uniswap', symbol: 'UNI', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 1000000000, circulatingSupply: 600000000, rank: 20 },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 1400000000, circulatingSupply: 1400000000, rank: 15 },
  { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR', image: '', price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, fdv: 0, high24h: 0, low24h: 0, totalSupply: 1190000000, circulatingSupply: 1130000000, rank: 18 },
];

const INTERVALS = [
  { label: '1H', value: '60' },
  { label: '6H', value: '360' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: 'M' },
];

const CATEGORIES = ['All', 'Majors', 'DeFi', 'DePN', 'Stocks', 'Commodities'];

const CATEGORY_TOKENS: Record<string, string[]> = {
  All: [],
  Majors: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOT', 'AVAX', 'DOGE'],
  DeFi: ['UNI', 'LINK', 'AAVE', 'MKR', 'CRV', 'LDO', 'COMP', 'SNX', 'PENDLE'],
  DePN: ['RENDER', 'FIL', 'THETA', 'GRT', 'AR'],
  Stocks: [],
  Commodities: [],
};

const BOTTOM_TABS = ['Portfolio', 'Trade History', 'Trades', 'Stats'];

function formatNumber(n: number): string {
  if (!n && n !== 0) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(p: number): string {
  if (!p && p !== 0) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
}

export default function MarketPage() {
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(POPULAR_TOKENS[0]);
  const [chartInterval, setChartInterval] = useState('D');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('Portfolio');
  const [tokenData, setTokenData] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [dexResults, setDexResults] = useState<DexResult[]>([]);
  const [dexLoading, setDexLoading] = useState(false);
  const [selectedDexToken, setSelectedDexToken] = useState<DexResult | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTokenData = useCallback(async (tokenId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/prices?ids=${tokenId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.prices && data.prices[tokenId]) {
          const p = data.prices[tokenId];
          setTokenData(prev => ({
            ...selectedToken,
            price: p.usd || 0,
            priceChange24h: p.usd_24h_change || 0,
            volume24h: p.usd_24h_vol || 0,
            marketCap: p.usd_market_cap || 0,
            high24h: p.usd * 1.02,
            low24h: p.usd * 0.98,
          }));
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [selectedToken]);

  useEffect(() => {
    fetchTokenData(selectedToken.id);
    const timer = globalThis.setInterval(() => fetchTokenData(selectedToken.id), 30000);
    return () => globalThis.clearInterval(timer);
  }, [selectedToken.id, fetchTokenData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowTokenSelector(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTokens = POPULAR_TOKENS.filter(t => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' ||
      (CATEGORY_TOKENS[activeCategory]?.includes(t.symbol));
    return matchesSearch && matchesCategory;
  });

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 2) {
      setDexResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setDexLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setDexResults(data.results || []);
      } catch {
        setDexResults([]);
      } finally {
        setDexLoading(false);
      }
    }, 400);
  };

  const handleDexSelect = (token: DexResult) => {
    setSelectedDexToken(token);
    setShowTokenSelector(false);
    setSearchQuery('');
    setDexResults([]);
  };

  const tradingSymbol = selectedDexToken
    ? (getTradingViewSymbol(selectedDexToken.symbol) || `BINANCE:${selectedDexToken.symbol}USDT`)
    : (getTradingViewSymbol(selectedToken.symbol) || `BINANCE:${selectedToken.symbol}USDT`);
  const priceChange = selectedDexToken ? selectedDexToken.change24h : (tokenData?.priceChange24h || selectedToken.priceChange24h);
  const isPositive = priceChange >= 0;
  const currentPrice = selectedDexToken ? selectedDexToken.priceUsd : (tokenData?.price || selectedToken.price);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-64px)]">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111827]/60">
            <div className="flex items-center gap-4">
              <div className="relative" ref={selectorRef}>
                <button
                  onClick={() => setShowTokenSelector(!showTokenSelector)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                >
                  {selectedDexToken ? (
                    <>
                      <span className="font-semibold text-lg">{selectedDexToken.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#0A1EFF]/20 text-[#0A1EFF] rounded font-medium">
                        {CHAIN_LABELS[selectedDexToken.chain] || selectedDexToken.chain.toUpperCase()}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-lg">{selectedToken.symbol}</span>
                      <span className="text-gray-400 text-sm">/ USDT</span>
                    </>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showTokenSelector && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-[#111827] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-white/5">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => handleSearchChange(e.target.value)}
                          placeholder="Name, symbol, or contract address..."
                          className="w-full pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50"
                          autoFocus
                        />
                        {dexLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1EFF] animate-spin" />
                        )}
                      </div>
                    </div>

                    {searchQuery.length >= 2 ? (
                      <div className="max-h-80 overflow-y-auto">
                        {dexLoading && dexResults.length === 0 ? (
                          <div className="p-6 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-[#0A1EFF]" />
                            Searching all chains...
                          </div>
                        ) : dexResults.length === 0 ? (
                          <div className="p-6 text-center text-gray-500 text-sm">No results found</div>
                        ) : (
                          <>
                            <div className="px-3 py-1.5 text-[10px] text-gray-500 flex items-center gap-1.5 border-b border-white/5">
                              <Zap className="w-3 h-3 text-[#0A1EFF]" />
                              DEXSCREENER — {dexResults.length} results across all chains
                            </div>
                            {dexResults.map((token, i) => (
                              <button
                                key={i}
                                onClick={() => handleDexSelect(token)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0A1EFF]/30 to-[#7C3AED]/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {token.symbol.slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{token.symbol}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-gray-400">
                                      {CHAIN_LABELS[token.chain] || token.chain.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 truncate">{token.name}</div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-sm font-mono">{token.price}</div>
                                  <div className="text-[10px]" style={{ color: token.change24h >= 0 ? '#10B981' : '#EF4444' }}>
                                    {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                                  </div>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1 px-3 py-2 border-b border-white/5 overflow-x-auto scrollbar-hide">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat}
                              onClick={() => setActiveCategory(cat)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                                activeCategory === cat
                                  ? 'bg-[#0A1EFF] text-white'
                                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                          {filteredTokens.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">No tokens found</div>
                          ) : (
                            filteredTokens.map(token => (
                              <button
                                key={token.id}
                                onClick={() => {
                                  setSelectedToken(token);
                                  setSelectedDexToken(null);
                                  setShowTokenSelector(false);
                                  setSearchQuery('');
                                  setDexResults([]);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors ${
                                  selectedToken.id === token.id && !selectedDexToken ? 'bg-[#0A1EFF]/10 border-l-2 border-[#0A1EFF]' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0A1EFF]/30 to-[#7C3AED]/30 flex items-center justify-center text-xs font-bold">
                                    {token.symbol.slice(0, 2)}
                                  </div>
                                  <div className="text-left">
                                    <div className="text-sm font-medium">{token.symbol}</div>
                                    <div className="text-xs text-gray-500">{token.name}</div>
                                  </div>
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); toggleFavorite(token.symbol); }}
                                  className="p-1"
                                >
                                  <Star className={`w-3.5 h-3.5 ${favorites.includes(token.symbol) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
                                </button>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold font-mono">
                  {loading && !currentPrice ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : (
                    formatPrice(currentPrice)
                  )}
                </span>
                <span className={`flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-md ${
                  isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                }`}>
                  {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {Math.abs(priceChange).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {INTERVALS.map(i => (
                <button
                  key={i.value}
                  onClick={() => setChartInterval(i.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    chartInterval === i.value
                      ? 'bg-neon-blue text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 px-4 py-2 border-b border-white/5 bg-[#0D1117]/80 overflow-x-auto scrollbar-hide text-xs">
            <StatItem label="24h Vol" value={formatNumber(tokenData?.volume24h || 0)} />
            <StatItem label="Mkt Cap" value={formatNumber(tokenData?.marketCap || 0)} />
            <StatItem label="FDV" value={formatNumber(selectedToken.fdv || tokenData?.marketCap || 0)} />
            <StatItem label="24h High" value={formatPrice(tokenData?.high24h || 0)} />
            <StatItem label="24h Low" value={formatPrice(tokenData?.low24h || 0)} />
          </div>

          <div className="flex-1 min-h-0 bg-[#0A0E1A]">
            <TradingViewChart
              symbol={tradingSymbol}
              height={600}
              interval={chartInterval}
              showTools={true}
            />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-px bg-white/5 border-t border-white/5">
            {selectedDexToken ? (
              <>
                <KeyStat label="Liquidity" value={formatNumber(selectedDexToken.liquidity)} />
                <KeyStat label="FDV" value={formatNumber(selectedDexToken.fdv)} />
                <KeyStat label="Vol 24h" value={formatNumber(selectedDexToken.volume24h)} />
                <KeyStat label="24h%" value={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`} positive={priceChange >= 0} />
                <KeyStat label="Chain" value={CHAIN_LABELS[selectedDexToken.chain] || selectedDexToken.chain.toUpperCase()} />
                <KeyStat label="Price" value={selectedDexToken.price} />
                <KeyStat label="Mcap" value="--" />
                <KeyStat label="Holders" value="--" />
                <KeyStat label="Age" value="--" />
              </>
            ) : (
              <>
                <KeyStat label="Liquidity" value={formatNumber((tokenData?.volume24h || 0) * 0.3)} />
                <KeyStat label="Mcap" value={formatNumber(tokenData?.marketCap || 0)} />
                <KeyStat label="FDV" value={formatNumber(selectedToken.fdv || tokenData?.marketCap || 0)} />
                <KeyStat label="Supply" value={selectedToken.circulatingSupply ? `${(selectedToken.circulatingSupply / 1e6).toFixed(0)}M` : '--'} />
                <KeyStat label="Vol 5m" value={formatNumber((tokenData?.volume24h || 0) / 288)} />
                <KeyStat label="Vol 24h" value={formatNumber(tokenData?.volume24h || 0)} />
                <KeyStat label="24h%" value={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`} positive={priceChange >= 0} />
                <KeyStat label="Holders" value="--" />
                <KeyStat label="Age" value="--" />
              </>
            )}
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-[#111827]/60">
            {selectedDexToken ? (
              <a
                href={selectedDexToken.dexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 rounded-lg font-semibold text-sm bg-[#0A1EFF] hover:bg-[#0818CC] text-white transition-colors text-center flex items-center justify-center gap-2"
              >
                View on DexScreener <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <>
                <button className="flex-1 py-3 rounded-lg font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-white transition-colors shadow-lg shadow-emerald-500/20">
                  Buy {selectedToken.symbol}
                </button>
                <button className="flex-1 py-3 rounded-lg font-semibold text-sm bg-red-500 hover:bg-red-400 text-white transition-colors shadow-lg shadow-red-500/20">
                  Sell {selectedToken.symbol}
                </button>
              </>
            )}
          </div>

          <div className="border-t border-white/5 bg-[#111827]/40">
            <div className="flex border-b border-white/5">
              {BOTTOM_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                    activeTab === tab
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 min-h-[120px]">
              {activeTab === 'Portfolio' && (
                <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                  <Wallet className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">Connect wallet to view portfolio</p>
                </div>
              )}
              {activeTab === 'Trade History' && (
                <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                  <Clock className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No trade history yet</p>
                </div>
              )}
              {activeTab === 'Trades' && (
                <div className="space-y-1">
                  <div className="grid grid-cols-4 text-xs text-gray-500 px-2 pb-1 border-b border-white/5">
                    <span>Price</span>
                    <span>Amount</span>
                    <span>Total</span>
                    <span className="text-right">Time</span>
                  </div>
                  {[...Array(5)].map((_, i) => {
                    const isBuy = Math.random() > 0.5;
                    const price = currentPrice * (1 + (Math.random() - 0.5) * 0.002);
                    const amount = Math.random() * 2;
                    return (
                      <div key={i} className="grid grid-cols-4 text-xs px-2 py-1.5 hover:bg-white/5 rounded">
                        <span className={isBuy ? 'text-emerald-400' : 'text-red-400'}>{formatPrice(price)}</span>
                        <span className="text-gray-300">{amount.toFixed(4)}</span>
                        <span className="text-gray-400">{formatNumber(price * amount)}</span>
                        <span className="text-right text-gray-500">Just now</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeTab === 'Stats' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MiniStat label="Market Cap Rank" value={`#${selectedToken.rank}`} />
                  <MiniStat label="Total Supply" value={selectedToken.totalSupply ? `${(selectedToken.totalSupply / 1e6).toFixed(0)}M` : '--'} />
                  <MiniStat label="Circulating" value={selectedToken.circulatingSupply ? `${(selectedToken.circulatingSupply / 1e6).toFixed(0)}M` : '--'} />
                  <MiniStat label="All-Time High" value="--" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hidden xl:block w-72 border-l border-white/5 bg-[#111827]/40 overflow-y-auto">
          <div className="p-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Watchlist</h3>
          </div>
          <div className="divide-y divide-white/5">
            {POPULAR_TOKENS.slice(0, 10).map(token => (
              <button
                key={token.id}
                onClick={() => setSelectedToken(token)}
                className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors ${
                  selectedToken.id === token.id ? 'bg-neon-blue/5 border-l-2 border-neon-blue' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-neon-blue/20 to-purple/20 flex items-center justify-center text-[10px] font-bold">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-medium">{token.symbol}</div>
                    <div className="text-[10px] text-gray-500">{token.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono">--</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-medium font-mono">{value}</span>
    </div>
  );
}

function KeyStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="px-3 py-2.5 bg-[#0D1117] text-center">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-xs font-medium font-mono ${
        positive !== undefined ? (positive ? 'text-emerald-400' : 'text-red-400') : 'text-gray-200'
      }`}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-medium font-mono">{value}</div>
    </div>
  );
}
