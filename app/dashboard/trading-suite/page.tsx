'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Zap, Eye, Search, Copy, Star,
  ArrowUpRight, ArrowDownRight, ExternalLink, Shield, Target, Radio,
  Wifi, Clock, BarChart3, Layers, Video, Users, Crown, Globe, Hash,
  Flame, Sparkles, AlertTriangle, Play, Volume2,
  MessageCircle, Heart, Share2, Award, Cpu, ChevronRight,
  ArrowLeftRight, DollarSign, Settings, Wallet, RefreshCw,
  Crosshair, Gauge, Lock, Droplets, ScanLine, Radar, Bolt
} from 'lucide-react';

interface TrendingToken {
  id: string; name: string; symbol: string; thumb: string;
  marketCapRank: number; price: number; priceChange24h: number;
  marketCap: string; volume: string; sparkline: string; score: number;
}

interface TopToken {
  id: string; name: string; symbol: string; image: string;
  price: number; priceChange1h: number; priceChange24h: number;
  priceChange7d: number; volume: number; marketCap: number;
  sparkline: number[]; high24h: number; low24h: number; rank: number;
}

const TABS = [
  { id: 'terminal', label: 'Terminal', icon: Crosshair },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'scanner', label: 'Scanner', icon: ScanLine },
  { id: 'sniper', label: 'Sniper', icon: Target },
  { id: 'pulse', label: 'Pulse', icon: Activity },
  { id: 'perps', label: 'Perps', icon: Layers },
  { id: 'live', label: 'LIVE', icon: Video },
];

export default function TradingSuitePage() {
  const [activeTab, setActiveTab] = useState('terminal');
  const [trending, setTrending] = useState<TrendingToken[]>([]);
  const [topTokens, setTopTokens] = useState<TopToken[]>([]);
  const [newPairs, setNewPairs] = useState<any[]>([]);
  const [fearGreed, setFearGreed] = useState({ value: '50', classification: 'Neutral' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteCA, setPasteCA] = useState('');
  const [showCAModal, setShowCAModal] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState<TopToken | null>(null);
  const [sniperSettings, setSniperSettings] = useState({ amount: '0.5', slippage: '15', antiMev: true, autoSell: false, takeProfit: '100', stopLoss: '50' });
  const [gasPrice, setGasPrice] = useState({ fast: 12, standard: 8, slow: 4 });
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

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => { const s = localStorage.getItem('steinz_watchlist'); if (s) setWatchlist(JSON.parse(s)); }, []);

  const toggleWatchlist = (id: string) => {
    setWatchlist(prev => { const n = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; localStorage.setItem('steinz_watchlist', JSON.stringify(n)); return n; });
  };

  const fmt = (n: number) => { if (!n) return '$0'; if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`; if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`; return `$${n.toFixed(2)}`; };
  const fmtP = (p: number) => { if (!p) return '$0'; if (p < 0.0001) return `$${p.toFixed(8)}`; if (p < 0.01) return `$${p.toFixed(6)}`; if (p < 1) return `$${p.toFixed(4)}`; if (p < 100) return `$${p.toFixed(2)}`; return `$${p.toLocaleString(undefined,{maximumFractionDigits:0})}`; };

  const Spark = ({ data, positive }: { data: number[]; positive: boolean }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data); const max = Math.max(...data); const r = max - min || 1;
    const pts = data.map((v, i) => `${(i/(data.length-1))*64},${24-((v-min)/r)*24}`).join(' ');
    return (<svg width={64} height={24} className="overflow-visible"><defs><linearGradient id={`sp-${positive?'g':'r'}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={positive?'#10B981':'#EF4444'} stopOpacity="0.2"/><stop offset="100%" stopColor={positive?'#10B981':'#EF4444'} stopOpacity="0"/></linearGradient></defs><polygon points={`0,24 ${pts} 64,24`} fill={`url(#sp-${positive?'g':'r'})`}/><polyline points={pts} fill="none" stroke={positive?'#10B981':'#EF4444'} strokeWidth="1.5" strokeLinecap="round"/></svg>);
  };

  const fgV = parseInt(fearGreed.value);
  const fgC = fgV >= 60 ? '#10B981' : fgV >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#060A12]/95 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="px-3 pt-2 pb-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] via-[#7C3AED] to-[#EF4444] rounded-lg flex items-center justify-center animate-pulse-slow">
                  <Crosshair className="w-4 h-4" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10B981] rounded-full border border-[#060A12]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-heading font-bold tracking-tight">STEINZ Terminal</h1>
                  <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-gradient-to-r from-[#00E5FF]/20 to-[#7C3AED]/20 text-[#00E5FF] border border-[#00E5FF]/20">PRO</span>
                </div>
                <div className="flex items-center gap-2 text-[8px]">
                  <span className="flex items-center gap-0.5 text-[#10B981]"><span className="w-1 h-1 bg-[#10B981] rounded-full animate-pulse"/>LIVE</span>
                  <span className="text-gray-600">|</span>
                  <span style={{color: fgC}}>F&G {fearGreed.value}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500">Gas: {gasPrice.fast}gwei</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowCAModal(true)} className="flex items-center gap-1 px-2 py-1.5 bg-[#0f1320] border border-[#1a1f2e] rounded-lg text-[9px] text-gray-400 hover:border-[#00E5FF]/30 hover:text-[#00E5FF] transition-all">
                <Copy className="w-2.5 h-2.5" /> CA
              </button>
              <div className="relative">
                <Search className="w-2.5 h-2.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Token or CA..." className="w-24 bg-[#0f1320] border border-[#1a1f2e] rounded-lg pl-6 pr-2 py-1.5 text-[9px] text-white focus:outline-none focus:border-[#00E5FF]/40 focus:w-40 transition-all placeholder:text-gray-600" />
              </div>
              <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <RefreshCw className={`w-3 h-3 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-0.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold whitespace-nowrap transition-all ${
                    active ? (tab.id === 'live' ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/20' : 'bg-[#0f1320] text-white border border-[#1a1f2e]')
                    : 'text-gray-600 hover:text-gray-400'
                  }`}>
                  <Icon className={`w-2.5 h-2.5 ${tab.id === 'live' && active ? 'animate-pulse' : ''}`} />
                  {tab.label}
                  {tab.id === 'live' && <span className="w-1 h-1 bg-[#EF4444] rounded-full animate-pulse"/>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showCAModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowCAModal(false)}>
          <div className="bg-[#0f1320] rounded-2xl p-5 w-full max-w-sm border border-[#1a1f2e] shadow-2xl shadow-[#00E5FF]/5" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold mb-1 flex items-center gap-2"><ScanLine className="w-4 h-4 text-[#00E5FF]"/>Scan Contract</div>
            <p className="text-[9px] text-gray-500 mb-3">Paste any token contract address for instant analysis</p>
            <input type="text" value={pasteCA} onChange={(e) => setPasteCA(e.target.value)} placeholder="0x... or So1..." className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50 font-mono mb-3" autoFocus />
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {['ETH','SOL','BSC','BASE','ARB','POLY'].map(c => (
                <button key={c} className="py-1.5 rounded-md border border-[#1a1f2e] text-[8px] font-semibold text-gray-500 hover:border-[#00E5FF]/30 hover:text-[#00E5FF] transition-all">{c}</button>
              ))}
            </div>
            <button onClick={() => { if (pasteCA) { setSearchQuery(pasteCA); setShowCAModal(false); setActiveTab('scanner'); }}} className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-2.5 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
              Analyze Token
            </button>
          </div>
        </div>
      )}

      <div className="px-3 pt-2">

        {activeTab === 'terminal' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1.5">
              <div className="bg-[#0f1320] rounded-lg p-2 border border-[#1a1f2e] text-center">
                <div className="text-[7px] text-gray-600 uppercase tracking-wider">MCap</div>
                <div className="text-[11px] font-bold text-[#00E5FF]">{fmt(topTokens.reduce((s,t)=>s+(t.marketCap||0),0))}</div>
              </div>
              <div className="bg-[#0f1320] rounded-lg p-2 border border-[#1a1f2e] text-center">
                <div className="text-[7px] text-gray-600 uppercase tracking-wider">Volume</div>
                <div className="text-[11px] font-bold text-[#7C3AED]">{fmt(topTokens.reduce((s,t)=>s+(t.volume||0),0))}</div>
              </div>
              <div className="bg-[#0f1320] rounded-lg p-2 border border-[#1a1f2e] text-center">
                <div className="text-[7px] text-gray-600 uppercase tracking-wider">F&G</div>
                <div className="text-[11px] font-bold" style={{color:fgC}}>{fearGreed.value}</div>
              </div>
              <div className="bg-[#0f1320] rounded-lg p-2 border border-[#1a1f2e] text-center">
                <div className="text-[7px] text-gray-600 uppercase tracking-wider">Gas</div>
                <div className="text-[11px] font-bold text-[#10B981]">{gasPrice.fast}g</div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] overflow-hidden">
              <div className="px-3 py-2 border-b border-[#1a1f2e] flex items-center justify-between">
                <span className="text-[9px] font-bold flex items-center gap-1.5"><Crown className="w-3 h-3 text-[#F59E0B]"/>Top Tokens</span>
                <div className="flex gap-0.5">
                  {['MCap','24h','Vol'].map((s,i) => (
                    <button key={s} className={`px-1.5 py-0.5 rounded text-[7px] font-semibold ${i===0?'bg-[#00E5FF]/10 text-[#00E5FF]':'text-gray-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              {loading ? <div className="p-8 text-center text-gray-600 text-[10px]">Loading terminal data...</div> : (
                <div className="divide-y divide-[#1a1f2e]/50">
                  {topTokens.filter(t => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.symbol?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 15).map((t, i) => (
                    <div key={t.id} onClick={() => setSelectedToken(selectedToken?.id === t.id ? null : t)} className={`px-3 py-2 flex items-center gap-2 cursor-pointer transition-all hover:bg-white/[0.02] ${selectedToken?.id === t.id ? 'bg-[#00E5FF]/[0.03]' : ''}`}>
                      <span className="text-[8px] text-gray-700 w-4 text-center font-mono">{t.rank||i+1}</span>
                      {t.image && <img src={t.image} alt="" className="w-5 h-5 rounded-full"/>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold">{t.symbol}</span>
                          <span className="text-[8px] text-gray-600 truncate">{t.name}</span>
                        </div>
                      </div>
                      <div className="w-12"><Spark data={t.sparkline} positive={(t.priceChange24h||0)>=0}/></div>
                      <div className="text-right w-16">
                        <div className="text-[10px] font-semibold font-mono">{fmtP(t.price)}</div>
                        <div className={`text-[8px] font-semibold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>
                          {(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%
                        </div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();toggleWatchlist(t.id)}} className="ml-1">
                        <Star className={`w-2.5 h-2.5 ${watchlist.includes(t.id)?'text-[#F59E0B] fill-[#F59E0B]':'text-gray-800 hover:text-gray-600'}`}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedToken && (
              <div className="bg-[#0f1320] rounded-xl border border-[#00E5FF]/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {selectedToken.image && <img src={selectedToken.image} alt="" className="w-6 h-6 rounded-full"/>}
                  <div className="flex-1">
                    <span className="text-xs font-bold">{selectedToken.symbol}</span>
                    <span className="text-[9px] text-gray-500 ml-1.5">{selectedToken.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono">{fmtP(selectedToken.price)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    {l:'1h',v:selectedToken.priceChange1h},{l:'24h',v:selectedToken.priceChange24h},{l:'7d',v:selectedToken.priceChange7d},
                    {l:'High',v:0,d:fmtP(selectedToken.high24h)},{l:'Low',v:0,d:fmtP(selectedToken.low24h)}
                  ].map((s,i)=>(
                    <div key={i} className="bg-[#060A12] rounded-md p-1.5 text-center">
                      <div className="text-[7px] text-gray-600 uppercase">{s.l}</div>
                      {s.d ? <div className="text-[9px] font-semibold font-mono">{s.d}</div> :
                      <div className={`text-[9px] font-bold ${(s.v||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(s.v||0)>=0?'+':''}{(s.v||0).toFixed(2)}%</div>}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-[#060A12] rounded-md p-1.5 text-center"><div className="text-[7px] text-gray-600">MCap</div><div className="text-[9px] font-semibold">{fmt(selectedToken.marketCap)}</div></div>
                  <div className="bg-[#060A12] rounded-md p-1.5 text-center"><div className="text-[7px] text-gray-600">Volume</div><div className="text-[9px] font-semibold">{fmt(selectedToken.volume)}</div></div>
                  <div className="bg-[#060A12] rounded-md p-1.5 text-center"><div className="text-[7px] text-gray-600">Rank</div><div className="text-[9px] font-semibold">#{selectedToken.rank}</div></div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button className="bg-[#10B981] py-2 rounded-lg text-[10px] font-bold hover:bg-[#10B981]/80 transition-colors flex items-center justify-center gap-1"><ArrowUpRight className="w-3 h-3"/>Quick Buy</button>
                  <button className="bg-[#EF4444] py-2 rounded-lg text-[10px] font-bold hover:bg-[#EF4444]/80 transition-colors flex items-center justify-center gap-1"><ArrowDownRight className="w-3 h-3"/>Quick Sell</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
                <div className="text-[9px] font-bold mb-2 flex items-center gap-1"><Flame className="w-3 h-3 text-[#F59E0B]"/>Hot Right Now</div>
                {trending.slice(0,5).map((t,i)=>(
                  <div key={t.id||i} className="flex items-center gap-2 py-1">
                    {t.thumb?<img src={t.thumb} alt="" className="w-4 h-4 rounded-full"/>:<div className="w-4 h-4 rounded-full bg-gray-800"/>}
                    <span className="text-[9px] font-semibold flex-1 truncate">{t.symbol}</span>
                    <span className={`text-[8px] font-bold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
                <div className="text-[9px] font-bold mb-2 flex items-center gap-1"><Droplets className="w-3 h-3 text-[#00E5FF]"/>New Listings</div>
                {newPairs.slice(0,5).map((p,i)=>(
                  <div key={i} className="flex items-center gap-2 py-1">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 flex items-center justify-center overflow-hidden">
                      {p.icon?<img src={p.icon} alt="" className="w-full h-full object-cover"/>:<Hash className="w-2 h-2 text-gray-600"/>}
                    </div>
                    <span className="text-[8px] font-mono text-gray-500 flex-1 truncate">{p.address?.slice(0,6)}...{p.address?.slice(-3)}</span>
                    <span className="text-[7px] px-1 py-0.5 rounded bg-white/5 text-gray-500 uppercase">{p.chain?.slice(0,3)}</span>
                  </div>
                ))}
                {newPairs.length === 0 && <div className="text-[8px] text-gray-700 text-center py-4">Scanning DEXes...</div>}
              </div>
            </div>

            {watchlist.length > 0 && (
              <div className="bg-[#0f1320] rounded-xl border border-[#F59E0B]/10 p-3">
                <div className="text-[9px] font-bold mb-2 flex items-center gap-1"><Star className="w-3 h-3 text-[#F59E0B]"/>Watchlist ({watchlist.length})</div>
                <div className="space-y-1">
                  {topTokens.filter(t => watchlist.includes(t.id)).map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1">
                      {t.image && <img src={t.image} alt="" className="w-4 h-4 rounded-full"/>}
                      <span className="text-[9px] font-semibold flex-1">{t.symbol}</span>
                      <span className="text-[9px] font-mono">{fmtP(t.price)}</span>
                      <span className={`text-[8px] font-bold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trending' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold flex items-center gap-1"><Flame className="w-3 h-3 text-[#F59E0B]"/>Trending Tokens</span>
              <span className="text-[8px] text-gray-600">CoinGecko Live</span>
            </div>
            {loading ? <div className="space-y-2">{[...Array(6)].map((_,i)=><div key={i} className="h-14 bg-[#0f1320] rounded-xl animate-pulse"/>)}</div> : (
              trending.filter(t => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.symbol?.toLowerCase().includes(searchQuery.toLowerCase())).map((t,i) => (
                <div key={t.id||i} className="bg-[#0f1320] rounded-xl p-3 border border-[#1a1f2e] hover:border-[#00E5FF]/15 transition-all group">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      {t.thumb?<img src={t.thumb} alt="" className="w-8 h-8 rounded-full ring-1 ring-[#1a1f2e]"/>:<div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 flex items-center justify-center text-[9px] font-bold">{t.symbol?.slice(0,2)}</div>}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#060A12] rounded-full flex items-center justify-center border border-[#1a1f2e]"><span className="text-[6px] font-bold text-gray-500">{i+1}</span></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1"><span className="text-[10px] font-bold">{t.symbol}</span><span className="text-[8px] text-gray-600 truncate">{t.name}</span></div>
                      <div className="flex items-center gap-2 text-[7px] text-gray-600">
                        {t.marketCapRank && <span>Rank #{t.marketCapRank}</span>}
                        <span>Score {(t.score||0)+1}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold">{t.marketCap || '-'}</div>
                      <div className={`text-[9px] font-semibold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%</div>
                    </div>
                    <button onClick={()=>toggleWatchlist(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Star className={`w-3 h-3 ${watchlist.includes(t.id)?'text-[#F59E0B] fill-[#F59E0B]':'text-gray-700'}`}/></button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-3">
            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-4">
              <div className="text-[10px] font-bold mb-2 flex items-center gap-1.5"><ScanLine className="w-3.5 h-3.5 text-[#00E5FF]"/>Token Scanner</div>
              <p className="text-[8px] text-gray-500 mb-3">Paste any contract address for instant safety analysis powered by GoPlus</p>
              <div className="flex gap-1.5">
                <input type="text" value={pasteCA} onChange={e=>setPasteCA(e.target.value)} placeholder="Contract address..." className="flex-1 bg-[#060A12] border border-[#1a1f2e] rounded-lg px-3 py-2 text-[10px] font-mono text-white focus:outline-none focus:border-[#00E5FF]/40"/>
                <button onClick={()=>{if(pasteCA)setSearchQuery(pasteCA)}} className="px-3 py-2 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-lg text-[9px] font-bold">Scan</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {icon:Shield,title:'Honeypot Check',desc:'Detect honeypot & rug pull contracts',color:'text-[#10B981]',bg:'bg-[#10B981]/5'},
                {icon:Droplets,title:'Liquidity Analysis',desc:'Pool depth, lock status, LP tokens',color:'text-[#00E5FF]',bg:'bg-[#00E5FF]/5'},
                {icon:Users,title:'Holder Distribution',desc:'Top holders, whale concentration',color:'text-[#7C3AED]',bg:'bg-[#7C3AED]/5'},
                {icon:Lock,title:'Contract Audit',desc:'Open source, proxy, mint functions',color:'text-[#F59E0B]',bg:'bg-[#F59E0B]/5'},
              ].map((f,i) => (
                <div key={i} className={`bg-[#0f1320] rounded-xl p-3 border border-[#1a1f2e] ${f.bg}`}>
                  <f.icon className={`w-5 h-5 ${f.color} mb-2`}/>
                  <div className="text-[9px] font-bold mb-0.5">{f.title}</div>
                  <div className="text-[7px] text-gray-500">{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="text-[9px] font-bold mb-2 flex items-center gap-1"><Gauge className="w-3 h-3 text-[#F59E0B]"/>Quick Checks</div>
              {[
                {l:'Buy/Sell Tax',v:'Detects hidden taxes',s:'✅'},
                {l:'Ownership Renounced',v:'Contract ownership status',s:'✅'},
                {l:'Blacklist Function',v:'Can addresses be blocked',s:'✅'},
                {l:'Trading Cooldown',v:'Anti-bot mechanisms',s:'✅'},
                {l:'Max TX Amount',v:'Transaction limits',s:'✅'},
                {l:'Proxy Contract',v:'Upgradeable logic detection',s:'✅'},
              ].map((c,i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#1a1f2e]/50 last:border-0">
                  <span className="text-[8px]">{c.s}</span>
                  <span className="text-[9px] font-semibold flex-1">{c.l}</span>
                  <span className="text-[7px] text-gray-600">{c.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sniper' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#EF4444]/5 to-[#F59E0B]/5 rounded-xl border border-[#EF4444]/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#EF4444] to-[#F59E0B] rounded-xl flex items-center justify-center shadow-lg shadow-[#EF4444]/20">
                  <Target className="w-5 h-5"/>
                </div>
                <div>
                  <div className="text-sm font-bold">Token Sniper</div>
                  <div className="text-[8px] text-gray-500">Auto-buy new tokens at launch with speed and precision</div>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[8px] text-gray-500 block mb-1">Buy Amount (SOL)</label>
                  <input type="text" value={sniperSettings.amount} onChange={e=>setSniperSettings(p=>({...p,amount:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00E5FF]/40"/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-gray-500 block mb-1">Slippage %</label>
                    <input type="text" value={sniperSettings.slippage} onChange={e=>setSniperSettings(p=>({...p,slippage:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00E5FF]/40"/>
                  </div>
                  <div>
                    <label className="text-[8px] text-gray-500 block mb-1">Priority Fee</label>
                    <select className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                      <option>Turbo (0.01)</option>
                      <option>Fast (0.005)</option>
                      <option>Normal (0.001)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="text-[9px] font-bold mb-2">Protection Settings</div>
              <div className="space-y-2">
                {[
                  {l:'Anti-MEV Protection',d:'Front-run protection via private mempool',k:'antiMev'},
                  {l:'Auto-Sell on Profit',d:'Automatically sell when target hit',k:'autoSell'},
                ].map((s,i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div><div className="text-[9px] font-semibold">{s.l}</div><div className="text-[7px] text-gray-600">{s.d}</div></div>
                    <button onClick={()=>setSniperSettings(p=>({...p,[s.k]:!(p as any)[s.k]}))} className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-colors ${(sniperSettings as any)[s.k]?'bg-[#10B981]':'bg-gray-700'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${(sniperSettings as any)[s.k]?'translate-x-4':'translate-x-0'}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="text-[9px] font-bold mb-2">Take Profit / Stop Loss</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[7px] text-[#10B981] block mb-1">Take Profit %</label>
                  <input type="text" value={sniperSettings.takeProfit} onChange={e=>setSniperSettings(p=>({...p,takeProfit:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-lg px-3 py-2 text-xs font-mono text-[#10B981] focus:outline-none focus:border-[#10B981]/40"/>
                </div>
                <div>
                  <label className="text-[7px] text-[#EF4444] block mb-1">Stop Loss %</label>
                  <input type="text" value={sniperSettings.stopLoss} onChange={e=>setSniperSettings(p=>({...p,stopLoss:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-lg px-3 py-2 text-xs font-mono text-[#EF4444] focus:outline-none focus:border-[#EF4444]/40"/>
                </div>
              </div>
            </div>

            <button className="w-full bg-gradient-to-r from-[#EF4444] to-[#F59E0B] py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Target className="w-4 h-4"/> Arm Sniper Bot
            </button>
            <p className="text-[7px] text-gray-600 text-center">Connect wallet to activate. Trading involves risk.</p>
          </div>
        )}

        {activeTab === 'pulse' && (
          <div className="space-y-3">
            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold">Fear & Greed</span>
                <span className="text-lg font-bold font-mono" style={{color:fgC}}>{fearGreed.value}</span>
              </div>
              <div className="h-2 bg-gradient-to-r from-[#EF4444] via-[#F59E0B] to-[#10B981] rounded-full relative">
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-[#060A12]" style={{left:`${Math.min(95,Math.max(5,fgV))}%`}}/>
              </div>
              <div className="flex justify-between mt-1 text-[7px] text-gray-600"><span>Fear</span><span>{fearGreed.classification}</span><span>Greed</span></div>
            </div>

            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="text-[9px] font-bold mb-2">Biggest Movers</div>
              {topTokens.slice().sort((a,b) => Math.abs(b.priceChange24h||0) - Math.abs(a.priceChange24h||0)).slice(0,10).map(t => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-[#1a1f2e]/30 last:border-0">
                  {t.image && <img src={t.image} alt="" className="w-4 h-4 rounded-full"/>}
                  <span className="text-[9px] font-semibold flex-1">{t.symbol}</span>
                  <div className="w-12"><Spark data={t.sparkline} positive={(t.priceChange24h||0)>=0}/></div>
                  <span className={`text-[9px] font-bold w-14 text-right ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>
                    {(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3 text-center">
                <div className="text-[7px] text-gray-600 uppercase mb-1">Total Market Cap</div>
                <div className="text-sm font-bold text-[#00E5FF]">{fmt(topTokens.reduce((s,t)=>s+(t.marketCap||0),0))}</div>
              </div>
              <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3 text-center">
                <div className="text-[7px] text-gray-600 uppercase mb-1">24h Volume</div>
                <div className="text-sm font-bold text-[#7C3AED]">{fmt(topTokens.reduce((s,t)=>s+(t.volume||0),0))}</div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="text-[9px] font-bold mb-2">Dominance</div>
              {topTokens.slice(0,5).map(t => {
                const dom = topTokens.reduce((s,x)=>s+(x.marketCap||0),0);
                const pct = dom ? ((t.marketCap||0)/dom)*100 : 0;
                return (
                  <div key={t.id} className="mb-2">
                    <div className="flex items-center justify-between text-[8px] mb-0.5">
                      <span className="font-semibold">{t.symbol}</span>
                      <span className="text-gray-500">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 bg-[#1a1f2e] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-full" style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'perps' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#7C3AED]/5 to-transparent rounded-xl border border-[#7C3AED]/15 p-5 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#7C3AED]/20">
                <Layers className="w-6 h-6"/>
              </div>
              <h3 className="text-base font-heading font-bold mb-1">Perpetual Futures</h3>
              <p className="text-[9px] text-gray-500 max-w-xs mx-auto mb-3">Up to 100x leverage. Cross-margin. Sub-second execution. AI-powered risk management.</p>
              <div className="grid grid-cols-4 gap-1 mb-3 max-w-xs mx-auto">
                {[{l:'Leverage',v:'100x'},{l:'Markets',v:'50+'},{l:'Fees',v:'0.02%'},{l:'Chains',v:'3'}].map(s=>(
                  <div key={s.l} className="bg-[#060A12] rounded-lg p-1.5"><div className="text-[7px] text-gray-600">{s.l}</div><div className="text-[10px] font-bold text-[#7C3AED]">{s.v}</div></div>
                ))}
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full">
                <Clock className="w-2.5 h-2.5 text-[#F59E0B]"/><span className="text-[8px] text-[#F59E0B] font-semibold">Q2 2026</span>
              </div>
            </div>
            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="text-[9px] font-bold mb-2">Features</div>
              {['Cross & Isolated Margin','Liquidation Shield (AI)','TP/SL, Trailing Stop, Iceberg','Real-time Funding Rates','VTX AI Position Sizing','Multi-chain Settlement'].map((f,i)=>(
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#1a1f2e]/50 last:border-0">
                  <div className="w-1 h-1 rounded-full bg-[#7C3AED]"/>
                  <span className="text-[9px] text-gray-300">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#EF4444]/5 to-[#F59E0B]/5 rounded-xl border border-[#EF4444]/15 p-5 text-center relative overflow-hidden">
              <div className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 bg-[#EF4444]/20 rounded-full"><span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full animate-pulse"/><span className="text-[7px] text-[#EF4444] font-bold">LIVE</span></div>
              <div className="w-12 h-12 bg-gradient-to-br from-[#EF4444] to-[#F59E0B] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#EF4444]/20">
                <Video className="w-6 h-6"/>
              </div>
              <h3 className="text-base font-heading font-bold mb-1">Live Trading Streams</h3>
              <p className="text-[9px] text-gray-500 max-w-xs mx-auto mb-3">Go live while you trade. Broadcast your screen, interact with viewers, let them copy your trades in real-time. First of its kind.</p>
              <div className="grid grid-cols-3 gap-1 mb-3 max-w-xs mx-auto">
                {[{l:'Stream',v:'HD Live'},{l:'Chat',v:'Real-time'},{l:'Copy',v:'1-Click'}].map(s=>(
                  <div key={s.l} className="bg-[#060A12] rounded-lg p-1.5"><div className="text-[7px] text-gray-600">{s.l}</div><div className="text-[9px] font-bold text-[#EF4444]">{s.v}</div></div>
                ))}
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full">
                <Clock className="w-2.5 h-2.5 text-[#F59E0B]"/><span className="text-[8px] text-[#F59E0B] font-semibold">Q3 2026</span>
              </div>
            </div>
            <div className="bg-[#0f1320] rounded-xl border border-[#1a1f2e] p-3">
              <div className="text-[9px] font-bold mb-2">How It Works</div>
              {[
                {s:'1',t:'Go Live',d:'Start streaming your trading session',c:'text-[#EF4444]'},
                {s:'2',t:'Trade Transparently',d:'Every trade shown in real-time',c:'text-[#00E5FF]'},
                {s:'3',t:'Interact',d:'Live chat, explain your thesis',c:'text-[#7C3AED]'},
                {s:'4',t:'Viewers Copy',d:'1-click copy with risk controls',c:'text-[#10B981]'},
                {s:'5',t:'Earn Revenue',d:'Subscribers, tips, copy-trade fees',c:'text-[#F59E0B]'},
              ].map((step,i)=>(
                <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-[#1a1f2e]/50 last:border-0">
                  <div className={`w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[8px] font-bold ${step.c}`}>{step.s}</div>
                  <div><div className="text-[9px] font-semibold">{step.t}</div><div className="text-[7px] text-gray-600">{step.d}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 mt-4 mb-2">
        <div className="bg-[#0f1320] rounded-lg p-2 border border-[#F59E0B]/10 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-[#F59E0B] shrink-0"/>
          <span className="text-[7px] text-gray-500"><span className="text-[#F59E0B] font-bold">PREVIEW</span> — Real data displayed. Trading features require wallet connection.</span>
        </div>
      </div>
    </div>
  );
}
