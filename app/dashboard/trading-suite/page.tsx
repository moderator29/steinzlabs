'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Zap, Radio, Eye, Search, Copy, Star,
  ArrowUpRight, ArrowDownRight, ChevronDown, ExternalLink, Shield, Target,
  Wifi, Clock, BarChart3, Layers, Video, Users, Crown, Globe, Hash,
  Flame, Sparkles, Filter, AlertTriangle, Lock, Play, Pause, Volume2,
  MessageCircle, Heart, Share2, Bookmark, Award, Cpu, ChevronRight,
  ArrowLeftRight, DollarSign, PieChart, Settings, Wallet, RefreshCw
} from 'lucide-react';

interface TrendingToken {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  marketCapRank: number;
  price: number;
  priceChange24h: number;
  marketCap: string;
  volume: string;
  sparkline: string;
  score: number;
}

interface TopToken {
  id: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  volume: number;
  marketCap: number;
  sparkline: number[];
  high24h: number;
  low24h: number;
  rank: number;
}

const TABS = [
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'top', label: 'Top', icon: Crown },
  { id: 'new-pairs', label: 'New Pairs', icon: Zap },
  { id: 'pulse', label: 'Pulse', icon: Activity },
  { id: 'perpetuals', label: 'Perpetuals', icon: Layers },
  { id: 'positions', label: 'Positions', icon: Wallet },
  { id: 'live', label: 'LIVE', icon: Video },
];

const TIME_FILTERS = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function TradingSuitePage() {
  const [activeTab, setActiveTab] = useState('trending');
  const [trending, setTrending] = useState<TrendingToken[]>([]);
  const [topTokens, setTopTokens] = useState<TopToken[]>([]);
  const [newPairs, setNewPairs] = useState<any[]>([]);
  const [fearGreed, setFearGreed] = useState({ value: '50', classification: 'Neutral' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteCA, setPasteCA] = useState('');
  const [showCAModal, setShowCAModal] = useState(false);
  const [timeFilter, setTimeFilter] = useState('5m');
  const [sortBy, setSortBy] = useState<'marketCap' | 'priceChange24h' | 'volume'>('marketCap');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState<TopToken | null>(null);
  const lastUpdate = useRef(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/trading-suite');
      if (res.ok) {
        const data = await res.json();
        setTrending(data.trending || []);
        setTopTokens(data.topTokens || []);
        setNewPairs(data.newPairs || []);
        setFearGreed(data.fearGreed || { value: '50', classification: 'Neutral' });
        lastUpdate.current = new Date();
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const saved = localStorage.getItem('steinz_watchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);

  const toggleWatchlist = (id: string) => {
    setWatchlist(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('steinz_watchlist', JSON.stringify(next));
      return next;
    });
  };

  const formatNumber = (n: number) => {
    if (!n) return '$0';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const formatPrice = (p: number) => {
    if (!p) return '$0';
    if (p < 0.0001) return `$${p.toFixed(8)}`;
    if (p < 0.01) return `$${p.toFixed(6)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    if (p < 100) return `$${p.toFixed(2)}`;
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const MiniSparkline = ({ data, positive }: { data: number[]; positive: boolean }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 80;
    const h = 28;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
    return (
      <svg width={w} height={h} className="overflow-visible">
        <defs>
          <linearGradient id={`sg-${positive ? 'g' : 'r'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={positive ? '#10B981' : '#EF4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={positive ? '#10B981' : '#EF4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#sg-${positive ? 'g' : 'r'})`} />
        <polyline points={points} fill="none" stroke={positive ? '#10B981' : '#EF4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const fgValue = parseInt(fearGreed.value);
  const fgColor = fgValue >= 75 ? 'text-[#10B981]' : fgValue >= 55 ? 'text-[#10B981]' : fgValue >= 45 ? 'text-[#F59E0B]' : fgValue >= 25 ? 'text-[#EF4444]' : 'text-[#EF4444]';

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <h1 className="text-sm font-heading font-bold">Trading Suite</h1>
                <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                  <span className="flex items-center gap-0.5"><Wifi className="w-2 h-2 text-[#10B981]" />Live</span>
                  <span>|</span>
                  <span className={fgColor}>F&G: {fearGreed.value} {fearGreed.classification}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowCAModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-[#111827] border border-white/10 rounded-lg text-[10px] text-gray-400 hover:border-[#00E5FF]/30 transition-all">
                <Copy className="w-3 h-3" /> Paste CA
              </button>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-28 bg-[#111827] border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-[#00E5FF]/50 focus:w-44 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-0.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? tab.id === 'live' ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'bg-gradient-to-r from-[#00E5FF]/15 to-[#7C3AED]/15 text-white border border-[#00E5FF]/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3 h-3 ${tab.id === 'live' && isActive ? 'animate-pulse' : ''}`} />
                  {tab.label}
                  {tab.id === 'live' && <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showCAModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCAModal(false)}>
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold mb-3 flex items-center gap-2">
              <Copy className="w-4 h-4 text-[#00E5FF]" />
              Paste Contract Address
            </div>
            <input
              type="text"
              value={pasteCA}
              onChange={(e) => setPasteCA(e.target.value)}
              placeholder="0x... or token address"
              className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50 font-mono mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { if (pasteCA) { setSearchQuery(pasteCA); setShowCAModal(false); setActiveTab('top'); }}} className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-2 rounded-lg text-xs font-semibold">
                Scan Token
              </button>
              <button onClick={() => setShowCAModal(false)} className="px-4 py-2 rounded-lg border border-white/10 text-xs text-gray-400">
                Cancel
              </button>
            </div>
            <p className="text-[9px] text-gray-600 mt-2 text-center">Supports Ethereum, Solana, BSC, Polygon, Arbitrum, Base</p>
          </div>
        </div>
      )}

      <div className="px-3 pt-3">

        {activeTab === 'trending' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-[#F59E0B]" /> Trending Now</h2>
                <span className="text-[9px] text-gray-600">via CoinGecko</span>
              </div>
              <div className="flex gap-1">
                {['5m', '1h', '24h'].map(t => (
                  <button key={t} onClick={() => setTimeFilter(t)} className={`px-2 py-0.5 rounded text-[9px] font-semibold ${timeFilter === t ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-gray-600 hover:text-gray-400'}`}>{t}</button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-2">
                {trending.filter(t => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.symbol?.toLowerCase().includes(searchQuery.toLowerCase())).map((token, i) => (
                  <div key={token.id || i} className="glass rounded-xl p-3 border border-white/5 hover:border-[#00E5FF]/20 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {token.thumb ? (
                          <img src={token.thumb} alt="" className="w-9 h-9 rounded-full ring-2 ring-white/10" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 flex items-center justify-center text-[10px] font-bold">{token.symbol?.slice(0, 2)}</div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0A0E1A] rounded-full flex items-center justify-center">
                          <span className="text-[8px] font-bold text-gray-400">#{i + 1}</span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{token.symbol}</span>
                          <span className="text-[9px] text-gray-500 truncate">{token.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {token.marketCapRank && <span className="text-[8px] text-gray-600">Rank #{token.marketCapRank}</span>}
                          <span className="text-[8px] text-gray-600">Score: {token.score !== undefined ? token.score + 1 : '-'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold">{token.marketCap || '-'}</div>
                        <div className={`text-[10px] font-semibold flex items-center gap-0.5 justify-end ${(token.priceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {(token.priceChange24h || 0) >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                          {Math.abs(token.priceChange24h || 0).toFixed(2)}%
                        </div>
                      </div>

                      <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(token.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Star className={`w-3.5 h-3.5 ${watchlist.includes(token.id) ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-gray-600'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'top' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-[#F59E0B]" /> Top by Market Cap</h2>
              </div>
              <div className="flex gap-1">
                {[
                  { key: 'marketCap' as const, label: 'MCap' },
                  { key: 'priceChange24h' as const, label: '24h%' },
                  { key: 'volume' as const, label: 'Vol' },
                ].map(s => (
                  <button key={s.key} onClick={() => setSortBy(s.key)} className={`px-2 py-0.5 rounded text-[9px] font-semibold ${sortBy === s.key ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-gray-600 hover:text-gray-400'}`}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-1 text-[8px] text-gray-600 px-3 uppercase tracking-wider">
              <span className="w-8">#</span>
              <span className="flex-1">Token</span>
              <span className="w-20 text-right">Price</span>
              <span className="w-16 text-right">24h</span>
              <span className="w-20 text-right hidden sm:block">Volume</span>
              <span className="w-20 text-center">Chart</span>
            </div>

            {loading ? (
              <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-1">
                {[...topTokens]
                  .filter(t => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.symbol?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => sortBy === 'priceChange24h' ? Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0) : sortBy === 'volume' ? (b.volume || 0) - (a.volume || 0) : (b.marketCap || 0) - (a.marketCap || 0))
                  .map((token, i) => (
                  <div
                    key={token.id}
                    onClick={() => setSelectedToken(selectedToken?.id === token.id ? null : token)}
                    className={`rounded-xl p-2.5 flex items-center gap-2 cursor-pointer transition-all ${selectedToken?.id === token.id ? 'bg-[#00E5FF]/5 border border-[#00E5FF]/20' : 'hover:bg-white/[0.03] border border-transparent'}`}
                  >
                    <span className="text-[9px] text-gray-600 w-5 text-center">{token.rank || i + 1}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {token.image && <img src={token.image} alt="" className="w-6 h-6 rounded-full" />}
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold truncate">{token.symbol}</div>
                        <div className="text-[8px] text-gray-500 truncate">{token.name}</div>
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <div className="text-[11px] font-semibold">{formatPrice(token.price)}</div>
                    </div>
                    <div className="w-16 text-right">
                      <span className={`text-[10px] font-semibold ${(token.priceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {(token.priceChange24h || 0) >= 0 ? '+' : ''}{(token.priceChange24h || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-20 text-right hidden sm:block">
                      <span className="text-[9px] text-gray-400">{formatNumber(token.volume)}</span>
                    </div>
                    <div className="w-20 flex justify-center">
                      <MiniSparkline data={token.sparkline} positive={(token.priceChange24h || 0) >= 0} />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(token.id); }}>
                      <Star className={`w-3 h-3 ${watchlist.includes(token.id) ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-gray-700 hover:text-gray-500'}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedToken && (
              <div className="glass rounded-xl p-4 border border-[#00E5FF]/20 mt-3 animate-in">
                <div className="flex items-center gap-3 mb-3">
                  {selectedToken.image && <img src={selectedToken.image} alt="" className="w-8 h-8 rounded-full" />}
                  <div>
                    <div className="text-sm font-bold">{selectedToken.name} ({selectedToken.symbol})</div>
                    <div className="text-[10px] text-gray-500">Rank #{selectedToken.rank}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-lg font-bold">{formatPrice(selectedToken.price)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[8px] text-gray-500 uppercase">1h</div>
                    <div className={`text-[11px] font-bold ${(selectedToken.priceChange1h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{(selectedToken.priceChange1h || 0).toFixed(2)}%</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[8px] text-gray-500 uppercase">24h</div>
                    <div className={`text-[11px] font-bold ${(selectedToken.priceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{(selectedToken.priceChange24h || 0).toFixed(2)}%</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[8px] text-gray-500 uppercase">7d</div>
                    <div className={`text-[11px] font-bold ${(selectedToken.priceChange7d || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{(selectedToken.priceChange7d || 0).toFixed(2)}%</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[8px] text-gray-500 uppercase">MCap</div>
                    <div className="text-[11px] font-bold text-white">{formatNumber(selectedToken.marketCap)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2 text-center">
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[8px] text-gray-500">24h High</div>
                    <div className="text-[10px] font-semibold text-[#10B981]">{formatPrice(selectedToken.high24h)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[8px] text-gray-500">24h Low</div>
                    <div className="text-[10px] font-semibold text-[#EF4444]">{formatPrice(selectedToken.low24h)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[8px] text-gray-500">Volume</div>
                    <div className="text-[10px] font-semibold">{formatNumber(selectedToken.volume)}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 bg-[#10B981] py-2 rounded-lg text-[11px] font-bold hover:bg-[#10B981]/80 transition-colors flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Buy
                  </button>
                  <button className="flex-1 bg-[#EF4444] py-2 rounded-lg text-[11px] font-bold hover:bg-[#EF4444]/80 transition-colors flex items-center justify-center gap-1">
                    <ArrowDownRight className="w-3 h-3" /> Sell
                  </button>
                  <button className="py-2 px-3 rounded-lg border border-white/10 text-[11px] font-semibold hover:bg-white/5 transition-colors">
                    <Shield className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'new-pairs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#00E5FF]" /> New Pairs</h2>
              <div className="flex items-center gap-1 text-[9px] text-gray-500">
                <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
                Live from DexScreener
              </div>
            </div>

            {newPairs.length > 0 ? (
              <div className="space-y-2">
                {newPairs.map((pair, i) => (
                  <div key={i} className="glass rounded-xl p-3 border border-white/5 hover:border-[#00E5FF]/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 flex items-center justify-center overflow-hidden">
                        {pair.icon ? <img src={pair.icon} alt="" className="w-full h-full object-cover" /> : <Hash className="w-4 h-4 text-[#00E5FF]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-gray-400 truncate">{pair.address?.slice(0, 6)}...{pair.address?.slice(-4)}</span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-white/10 text-gray-400 uppercase">{pair.chain}</span>
                        </div>
                        {pair.description && <p className="text-[9px] text-gray-500 truncate mt-0.5">{pair.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                          <Eye className="w-3 h-3 text-gray-500" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                          <ExternalLink className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-500">
                <Zap className="w-8 h-8 mx-auto mb-3 text-gray-700" />
                <p className="text-xs">Loading new pairs from DEX aggregators...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pulse' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-[#7C3AED]" /> Market Pulse</h2>
              <div className="text-[9px] text-gray-500">Real-time sentiment</div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-gray-400">Fear & Greed Index</span>
                <span className={`text-sm font-bold ${fgColor}`}>{fearGreed.value}</span>
              </div>
              <div className="h-3 bg-gradient-to-r from-[#EF4444] via-[#F59E0B] to-[#10B981] rounded-full relative">
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-[#0A0E1A]" style={{ left: `${Math.min(95, Math.max(5, fgValue))}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[8px] text-gray-600">
                <span>Extreme Fear</span>
                <span>Neutral</span>
                <span>Extreme Greed</span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] font-bold mb-3">Market Movers (24h)</div>
              <div className="space-y-2">
                {topTokens.slice().sort((a, b) => Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0)).slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    {t.image && <img src={t.image} alt="" className="w-5 h-5 rounded-full" />}
                    <span className="text-[10px] font-semibold flex-1">{t.symbol}</span>
                    <div className="w-16"><MiniSparkline data={t.sparkline} positive={(t.priceChange24h || 0) >= 0} /></div>
                    <span className={`text-[10px] font-bold w-16 text-right ${(t.priceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {(t.priceChange24h || 0) >= 0 ? '+' : ''}{(t.priceChange24h || 0).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="glass rounded-xl p-3 border border-white/5 text-center">
                <div className="text-[9px] text-gray-500 uppercase">Total MCap</div>
                <div className="text-sm font-bold text-[#00E5FF]">{formatNumber(topTokens.reduce((s, t) => s + (t.marketCap || 0), 0))}</div>
              </div>
              <div className="glass rounded-xl p-3 border border-white/5 text-center">
                <div className="text-[9px] text-gray-500 uppercase">24h Volume</div>
                <div className="text-sm font-bold text-[#7C3AED]">{formatNumber(topTokens.reduce((s, t) => s + (t.volume || 0), 0))}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'perpetuals' && (
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5 border border-[#7C3AED]/20 bg-gradient-to-br from-[#7C3AED]/5 to-transparent text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#7C3AED]/30">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-heading font-bold mb-2">Perpetual Futures</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4 leading-relaxed">
                Trade perpetual contracts with up to 100x leverage. Cross-margin, isolated positions, advanced order types, and real-time liquidation protection.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4 max-w-xs mx-auto">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500">Max Leverage</div>
                  <div className="text-sm font-bold text-[#7C3AED]">100x</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500">Markets</div>
                  <div className="text-sm font-bold text-[#00E5FF]">50+</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500">Fees</div>
                  <div className="text-sm font-bold text-[#10B981]">0.02%</div>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full">
                <Clock className="w-3 h-3 text-[#F59E0B]" />
                <span className="text-[10px] text-[#F59E0B] font-semibold">Coming Q2 2026</span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] font-bold mb-3">Planned Features</div>
              <div className="space-y-2">
                {[
                  { icon: ArrowLeftRight, label: 'Cross & Isolated Margin', desc: 'Flexible margin modes for every strategy' },
                  { icon: Shield, label: 'Liquidation Protection', desc: 'Auto-deleverage and insurance fund' },
                  { icon: Target, label: 'Advanced Order Types', desc: 'TP/SL, trailing stop, iceberg orders' },
                  { icon: BarChart3, label: 'Real-time Funding Rates', desc: 'Transparent 8-hour funding cycles' },
                  { icon: Cpu, label: 'AI Position Sizing', desc: 'VTX AI suggests optimal position sizes' },
                  { icon: Globe, label: 'Multi-chain Settlement', desc: 'Settle on ETH, SOL, or Arbitrum' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                      <f.icon className="w-3.5 h-3.5 text-[#7C3AED]" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold">{f.label}</div>
                      <div className="text-[9px] text-gray-500">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              {['Active Positions', 'Watchlist', 'Top 100', 'History'].map((tab, i) => (
                <button key={tab} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${i === 0 ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>
              ))}
            </div>

            <div className="glass rounded-xl border border-white/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex gap-4 text-[10px]">
                  <span className="text-gray-500">Token</span>
                  <span className="text-gray-500">Bought</span>
                  <span className="text-gray-500">Sold</span>
                  <span className="text-gray-500">P&L</span>
                </div>
              </div>
              <div className="p-8 text-center">
                <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                <p className="text-xs text-gray-500 mb-1">No active positions</p>
                <p className="text-[9px] text-gray-600">Connect your wallet to start tracking positions</p>
                <button className="mt-4 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-5 py-2 rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity">
                  Connect Wallet
                </button>
              </div>
            </div>

            {watchlist.length > 0 && (
              <div className="glass rounded-xl p-4 border border-white/5">
                <div className="text-[10px] font-bold mb-2 flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-[#F59E0B]" /> Your Watchlist ({watchlist.length})
                </div>
                <div className="space-y-1.5">
                  {topTokens.filter(t => watchlist.includes(t.id)).map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1">
                      {t.image && <img src={t.image} alt="" className="w-5 h-5 rounded-full" />}
                      <span className="text-[10px] font-semibold flex-1">{t.symbol}</span>
                      <span className="text-[10px] font-semibold">{formatPrice(t.price)}</span>
                      <span className={`text-[9px] font-semibold ${(t.priceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {(t.priceChange24h || 0) >= 0 ? '+' : ''}{(t.priceChange24h || 0).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                  {trending.filter(t => watchlist.includes(t.id)).map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1">
                      {t.thumb && <img src={t.thumb} alt="" className="w-5 h-5 rounded-full" />}
                      <span className="text-[10px] font-semibold flex-1">{t.symbol}</span>
                      <span className={`text-[9px] font-semibold ${(t.priceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {(t.priceChange24h || 0) >= 0 ? '+' : ''}{(t.priceChange24h || 0).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] font-bold mb-3">Trading Wallet</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'SOL', icon: '◎', bal: '0' },
                  { label: 'USDC', icon: '$', bal: '0' },
                  { label: 'ETH', icon: 'Ξ', bal: '0' },
                ].map(w => (
                  <div key={w.label} className="bg-white/5 rounded-lg p-2.5 text-center">
                    <div className="text-[14px] mb-0.5">{w.icon}</div>
                    <div className="text-[9px] text-gray-500">{w.label}</div>
                    <div className="text-[10px] font-semibold">{w.bal}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {['Deposit', 'Withdraw', 'Create', 'Import'].map(action => (
                  <button key={action} className="py-2 rounded-lg border border-white/10 text-[9px] font-semibold hover:bg-white/5 transition-colors">{action}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5 border border-[#EF4444]/20 bg-gradient-to-br from-[#EF4444]/5 to-transparent text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-[#EF4444] to-[#F59E0B] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#EF4444]/30 relative">
                <Video className="w-7 h-7" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#EF4444] rounded-full animate-pulse" />
              </div>
              <h3 className="text-lg font-heading font-bold mb-2">LIVE Trading Streams</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4 leading-relaxed">
                Watch and broadcast live trading sessions. Go live while you trade, share your screen, interact with viewers, and build your following. The first platform where you can livestream your trades in real-time.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4 max-w-xs mx-auto">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500">Viewers</div>
                  <div className="text-sm font-bold text-[#EF4444]">Live</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500">Chat</div>
                  <div className="text-sm font-bold text-[#00E5FF]">Real-time</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500">Copy Trades</div>
                  <div className="text-sm font-bold text-[#10B981]">1-Click</div>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full mb-4">
                <Clock className="w-3 h-3 text-[#F59E0B]" />
                <span className="text-[10px] text-[#F59E0B] font-semibold">Coming Q3 2026</span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] font-bold mb-3">How LIVE Trading Works</div>
              <div className="space-y-3">
                {[
                  { step: '01', title: 'Go Live', desc: 'Start streaming your trading session with one click. Your screen, charts, and positions are shared.', icon: Play, color: 'text-[#EF4444]' },
                  { step: '02', title: 'Trade Transparently', desc: 'Every buy and sell is shown in real-time. Viewers see your entries, exits, and P&L live.', icon: Eye, color: 'text-[#00E5FF]' },
                  { step: '03', title: 'Interact & Chat', desc: 'Live chat with viewers, explain your thesis, answer questions. Build a community.', icon: MessageCircle, color: 'text-[#7C3AED]' },
                  { step: '04', title: 'Viewers Copy', desc: 'Viewers can copy your trades with 1-click. Set allocation limits and risk controls.', icon: Copy, color: 'text-[#10B981]' },
                  { step: '05', title: 'Earn Revenue', desc: 'Earn from subscribers, tips, and a share of copy-trade fees. Monetize your alpha.', icon: DollarSign, color: 'text-[#F59E0B]' },
                ].map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${s.color}`}>
                        <s.icon className="w-4 h-4" />
                      </div>
                      {i < 4 && <div className="w-px h-full bg-white/10 my-1" />}
                    </div>
                    <div className="pb-2">
                      <div className="text-[10px] font-bold">{s.title}</div>
                      <div className="text-[9px] text-gray-500 leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] font-bold mb-3">Why This Changes Everything</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { title: 'Full Transparency', desc: 'No fake screenshots. Real trades, real-time.' },
                  { title: 'Copy with Confidence', desc: 'See exactly what top traders do, live.' },
                  { title: 'Revenue for Traders', desc: 'Monetize your skills, not just your capital.' },
                  { title: 'Community First', desc: 'Learn from the best in real-time chat.' },
                ].map((f, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-2.5">
                    <div className="text-[9px] font-bold mb-0.5">{f.title}</div>
                    <div className="text-[8px] text-gray-500">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="px-3 mt-6 mb-4">
        <div className="glass rounded-xl p-3 border border-[#F59E0B]/20 bg-[#F59E0B]/5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
          <div>
            <span className="text-[9px] text-[#F59E0B] font-bold">DEMO MODE</span>
            <span className="text-[9px] text-gray-400 ml-1">Trading Suite is in preview. Real data shown, trading features coming soon.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
