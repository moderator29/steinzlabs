'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, Activity, Zap, Eye, Search, Copy, Star,
  ArrowUpRight, ArrowDownRight, ExternalLink, Shield, Target, Radio,
  Wifi, Clock, BarChart3, Layers, Video, Users, Crown, Globe, Hash,
  Flame, Sparkles, AlertTriangle, Play, Volume2,
  MessageCircle, Heart, Share2, Award, Cpu, ChevronRight, ChevronDown,
  ArrowLeftRight, DollarSign, Settings, Wallet, RotateCcw, X,
  Crosshair, Gauge, Lock, Droplets, ScanLine, Radar, Bolt,
  BookOpen, Mic, Camera, Gift, Trophy, LineChart, CandlestickChart,
  ArrowLeft, LayoutGrid, Bell, Percent, ChevronUp, Info, CheckCircle2, XCircle
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

interface CAResult {
  token: {
    name: string; symbol: string; address: string; price: number;
    priceChange5m: number; priceChange1h: number; priceChange6h: number; priceChange24h: number;
    volume24h: number; volume6h: number; volume1h: number;
    liquidity: number; liquidityBase: number; liquidityQuote: number;
    fdv: number; marketCap: number; pairAddress: string; dexId: string; chain: string;
    url: string; image: string | null; websites: any[]; socials: any[];
    txns24h: { buys: number; sells: number };
    txns6h: { buys: number; sells: number };
    txns1h: { buys: number; sells: number };
    createdAt: number;
  } | null;
  security: {
    isHoneypot: boolean; buyTax: number; sellTax: number;
    isOpenSource: boolean; isProxy: boolean; isMintable: boolean;
    ownershipRenounced: boolean; hasBlacklist: boolean;
    holderCount: number; lpHolderCount: number; totalSupply: string;
    creatorAddress: string; ownerAddress: string;
    topHolders: { address: string; percent: string; isContract: boolean; isLocked: boolean }[];
    lpHolders: { address: string; percent: string; isLocked: boolean }[];
  } | null;
  pairs: { dex: string; pair: string; price: string; liquidity: number; volume24h: number; chain: string }[];
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
  const router = useRouter();
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
  const [showChart, setShowChart] = useState(false);
  const [caResult, setCAResult] = useState<CAResult | null>(null);
  const [caLoading, setCALoading] = useState(false);
  const [caError, setCAError] = useState('');
  const [selectedChain, setSelectedChain] = useState('ETH');
  const [sniperSettings, setSniperSettings] = useState({ amount: '0.5', slippage: '15', antiMev: true, autoSell: false, takeProfit: '100', stopLoss: '50' });
  const [gasPrice, setGasPrice] = useState({ fast: 12, standard: 8, slow: 4 });
  const [bottomTab, setBottomTab] = useState('market');
  const chartRef = useRef<HTMLDivElement>(null);
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
    } catch (e) { // removed log
}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => { const s = localStorage.getItem('steinz_watchlist'); if (s) setWatchlist(JSON.parse(s)); }, []);

  const lookupCA = async (address: string, chain: string) => {
    setCALoading(true);
    setCAError('');
    setCAResult(null);
    try {
      const res = await fetch(`/api/ca-lookup?address=${encodeURIComponent(address)}&chain=${chain}`);
      if (res.ok) {
        const data = await res.json();
        setCAResult(data);
        setShowCAModal(false);
        setActiveTab('scanner');
      } else {
        const err = await res.json();
        setCAError(err.error || 'Token not found');
      }
    } catch {
      setCAError('Lookup failed. Check address and try again.');
    }
    setCALoading(false);
  };

  useEffect(() => {
    if (showChart && selectedToken && chartRef.current) {
      chartRef.current.innerHTML = '';
      const symbolMap: Record<string, string> = {
        BTC: 'BINANCE:BTCUSDT', ETH: 'BINANCE:ETHUSDT', SOL: 'BINANCE:SOLUSDT',
        BNB: 'BINANCE:BNBUSDT', DOGE: 'BINANCE:DOGEUSDT', XRP: 'BINANCE:XRPUSDT',
        ADA: 'BINANCE:ADAUSDT', AVAX: 'BINANCE:AVAXUSDT', DOT: 'BINANCE:DOTUSDT',
        LINK: 'BINANCE:LINKUSDT', UNI: 'BINANCE:UNIUSDT', SHIB: 'BINANCE:SHIBUSDT',
        PEPE: 'BINANCE:PEPEUSDT', ARB: 'BINANCE:ARBUSDT', OP: 'BINANCE:OPUSDT',
        SUI: 'BINANCE:SUIUSDT', NEAR: 'BINANCE:NEARUSDT', ATOM: 'BINANCE:ATOMUSDT',
        APT: 'BINANCE:APTUSDT', FIL: 'BINANCE:FILUSDT', INJ: 'BINANCE:INJUSDT',
        MATIC: 'BINANCE:MATICUSDT', RENDER: 'BINANCE:RENDERUSDT', TIA: 'BINANCE:TIAUSDT',
        SEI: 'BINANCE:SEIUSDT', BONK: 'BYBIT:BONKUSDT', WIF: 'BYBIT:WIFUSDT',
      };
      if (!symbolMap[selectedToken.symbol]) {
        const fallback = document.createElement('div');
        fallback.setAttribute('style', 'display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-size:14px;flex-direction:column;gap:8px');
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '32'); svg.setAttribute('height', '32');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
        const p1 = document.createElementNS(svgNS, 'path'); p1.setAttribute('d', 'M3 3v18h18'); svg.appendChild(p1);
        const p2 = document.createElementNS(svgNS, 'path'); p2.setAttribute('d', 'm19 9-5 5-4-4-3 3'); svg.appendChild(p2);
        const msg = document.createElement('span');
        msg.textContent = `Chart not available for ${selectedToken.symbol}. Only major tokens supported.`;
        fallback.appendChild(svg);
        fallback.appendChild(msg);
        chartRef.current.replaceChildren(fallback);
        return;
      }
      const tvSymbol = symbolMap[selectedToken.symbol];
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.async = true;
      script.textContent = JSON.stringify({
        autosize: true, symbol: tvSymbol, interval: '15', timezone: 'Etc/UTC',
        theme: 'dark', style: '1', locale: 'en', backgroundColor: '#0a0e1a',
        gridColor: 'rgba(255,255,255,0.03)', hide_top_toolbar: false,
        hide_legend: false, save_image: false, hide_volume: false,
        support_host: 'https://www.tradingview.com',
      });
      const container = document.createElement('div');
      container.className = 'tradingview-widget-container__widget';
      container.style.height = '100%';
      container.style.width = '100%';
      chartRef.current.appendChild(container);
      chartRef.current.appendChild(script);
    }
    return () => { if (chartRef.current) chartRef.current.innerHTML = ''; };
  }, [showChart, selectedToken]);

  const toggleWatchlist = (id: string) => {
    setWatchlist(prev => { const n = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; localStorage.setItem('steinz_watchlist', JSON.stringify(n)); return n; });
  };

  const fmt = (n: number) => { if (!n) return '$0'; if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`; if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`; return `$${n.toFixed(2)}`; };
  const fmtP = (p: number) => { if (!p) return '$0'; if (p < 0.0001) return `$${p.toFixed(8)}`; if (p < 0.01) return `$${p.toFixed(6)}`; if (p < 1) return `$${p.toFixed(4)}`; if (p < 100) return `$${p.toFixed(2)}`; return `$${p.toLocaleString(undefined,{maximumFractionDigits:0})}`; };

  const Spark = ({ data, positive }: { data: number[]; positive: boolean }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data); const max = Math.max(...data); const r = max - min || 1;
    const pts = data.map((v, i) => `${(i/(data.length-1))*72},${28-((v-min)/r)*28}`).join(' ');
    return (<svg width={72} height={28} className="overflow-visible"><defs><linearGradient id={`sp-${positive?'g':'r'}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={positive?'#10B981':'#EF4444'} stopOpacity="0.2"/><stop offset="100%" stopColor={positive?'#10B981':'#EF4444'} stopOpacity="0"/></linearGradient></defs><polygon points={`0,28 ${pts} 72,28`} fill={`url(#sp-${positive?'g':'r'})`}/><polyline points={pts} fill="none" stroke={positive?'#10B981':'#EF4444'} strokeWidth="1.5" strokeLinecap="round"/></svg>);
  };

  const fgV = parseInt(fearGreed.value);
  const fgC = fgV >= 60 ? '#10B981' : fgV >= 40 ? '#F59E0B' : '#EF4444';

  const SecurityBadge = ({ pass, label }: { pass: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border ${pass ? 'bg-[#10B981]/5 border-[#10B981]/20' : 'bg-[#EF4444]/5 border-[#EF4444]/20'}`}>
      {pass ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" /> : <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />}
      <span className={`text-[10px] font-medium ${pass ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-32">
      <div className="sticky top-0 z-40 bg-[#060A12]/95 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => router.back()} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0">
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] via-[#7C3AED] to-[#EF4444] rounded-xl flex items-center justify-center">
                  <Crosshair className="w-4 h-4" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10B981] rounded-full border-2 border-[#060A12]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-bold tracking-tight">STEINZ Terminal</h1>
                  <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-gradient-to-r from-[#0A1EFF]/20 to-[#7C3AED]/20 text-[#0A1EFF] border border-[#0A1EFF]/20">PRO</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] mt-0.5">
                  <span className="flex items-center gap-1 text-[#10B981]"><span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"/>LIVE</span>
                  <span className="text-gray-700">|</span>
                  <span style={{color: fgC}}>F&G {fearGreed.value}</span>
                  <span className="text-gray-700">|</span>
                  <span className="text-gray-500">Gas: {gasPrice.fast}gwei</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCAModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#0f1320] border border-[#1a1f2e] rounded-xl text-[10px] text-gray-400 hover:border-[#0A1EFF]/30 hover:text-[#0A1EFF] transition-all">
                <Copy className="w-3 h-3" /> CA
              </button>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Token or CA..." className="w-28 bg-[#0f1320] border border-[#1a1f2e] rounded-xl pl-7 pr-3 py-2 text-[10px] text-white focus:outline-none focus:border-[#0A1EFF]/40 focus:w-44 transition-all placeholder:text-gray-600" />
              </div>
              <button onClick={fetchData} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                <RotateCcw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                    active ? (tab.id === 'live' ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/20' : 'bg-[#0f1320] text-white border border-[#1a1f2e]')
                    : 'text-gray-600 hover:text-gray-400'
                  }`}>
                  <Icon className={`w-3 h-3 ${tab.id === 'live' && active ? 'animate-pulse' : ''}`} />
                  {tab.label}
                  {tab.id === 'live' && <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full animate-pulse"/>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showCAModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowCAModal(false)}>
          <div className="bg-[#0a0e1a] rounded-2xl p-6 w-full max-w-sm border border-[#1a1f2e] shadow-2xl shadow-[#0A1EFF]/5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-lg flex items-center justify-center">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold">Contract Lookup</div>
                  <div className="text-[9px] text-gray-500">Paste any token CA for instant data</div>
                </div>
              </div>
              <button onClick={() => setShowCAModal(false)} className="p-1 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-gray-500"/></button>
            </div>

            <input type="text" value={pasteCA} onChange={(e) => setPasteCA(e.target.value)} placeholder="0x... or So1... paste contract address" className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#0A1EFF]/50 font-mono mb-4" autoFocus />

            <div className="mb-4">
              <div className="text-[9px] text-gray-500 mb-2 font-medium">Select Chain</div>
              <div className="grid grid-cols-3 gap-2">
                {['ETH','SOL','BSC','BASE','ARB','POLY'].map(c => (
                  <button key={c} onClick={() => setSelectedChain(c)}
                    className={`py-2 rounded-lg border text-[10px] font-semibold transition-all ${selectedChain === c ? 'border-[#0A1EFF]/50 text-[#0A1EFF] bg-[#0A1EFF]/5' : 'border-[#1a1f2e] text-gray-500 hover:border-[#0A1EFF]/30 hover:text-[#0A1EFF]'}`}>{c}</button>
                ))}
              </div>
            </div>

            {caError && <div className="mb-3 px-3 py-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[10px] text-[#EF4444]">{caError}</div>}

            <button onClick={() => { if (pasteCA) lookupCA(pasteCA, selectedChain); }}
              disabled={caLoading || !pasteCA}
              className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              {caLoading ? <><RotateCcw className="w-4 h-4 animate-spin"/>Scanning...</> : <><ScanLine className="w-4 h-4"/>Analyze Token</>}
            </button>
          </div>
        </div>
      )}

      {showChart && selectedToken && (
        <div className="fixed inset-0 z-50 bg-[#060A12] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1f2e]">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowChart(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><ArrowLeft className="w-4 h-4"/></button>
              {selectedToken.image && <img src={selectedToken.image} alt="" className="w-6 h-6 rounded-full"/>}
              <div>
                <span className="text-sm font-bold">{selectedToken.symbol}/USDT</span>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="font-mono font-semibold">{fmtP(selectedToken.price)}</span>
                  <span className={`font-semibold ${(selectedToken.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>
                    {(selectedToken.priceChange24h||0)>=0?'+':''}{(selectedToken.priceChange24h||0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>toggleWatchlist(selectedToken.id)} className="p-1.5 hover:bg-white/5 rounded-lg">
                <Star className={`w-4 h-4 ${watchlist.includes(selectedToken.id)?'text-[#F59E0B] fill-[#F59E0B]':'text-gray-600'}`}/>
              </button>
              <a href={`https://www.coingecko.com/en/coins/${selectedToken.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-white/5 rounded-lg">
                <ExternalLink className="w-4 h-4 text-gray-600"/>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-px bg-[#1a1f2e] border-b border-[#1a1f2e]">
            {[
              {l:'24h High',v:fmtP(selectedToken.high24h),c:'text-[#10B981]'},
              {l:'24h Low',v:fmtP(selectedToken.low24h),c:'text-[#EF4444]'},
              {l:'Volume',v:fmt(selectedToken.volume),c:'text-[#7C3AED]'},
              {l:'MCap',v:fmt(selectedToken.marketCap),c:'text-[#0A1EFF]'},
            ].map(s=>(
              <div key={s.l} className="bg-[#060A12] px-3 py-2 text-center">
                <div className="text-[8px] text-gray-600 uppercase">{s.l}</div>
                <div className={`text-[11px] font-bold font-mono ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <div ref={chartRef} className="flex-1 min-h-0">
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
              <RotateCcw className="w-5 h-5 animate-spin mr-2"/>Loading chart...
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 border-t border-[#1a1f2e]">
            <button className="bg-[#10B981] py-3 rounded-xl text-sm font-bold hover:bg-[#10B981]/80 transition-colors flex items-center justify-center gap-2">
              <ArrowUpRight className="w-4 h-4"/>Buy {selectedToken.symbol}
            </button>
            <button className="bg-[#EF4444] py-3 rounded-xl text-sm font-bold hover:bg-[#EF4444]/80 transition-colors flex items-center justify-center gap-2">
              <ArrowDownRight className="w-4 h-4"/>Sell {selectedToken.symbol}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 max-w-7xl mx-auto">

        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                {label:'Total MCap',value:fmt(topTokens.reduce((s,t)=>s+(t.marketCap||0),0)),color:'text-[#0A1EFF]',icon:Globe},
                {label:'24h Volume',value:fmt(topTokens.reduce((s,t)=>s+(t.volume||0),0)),color:'text-[#7C3AED]',icon:BarChart3},
                {label:'Fear & Greed',value:fearGreed.value,color:'',icon:Activity,customColor:fgC},
                {label:'Gas (Gwei)',value:`${gasPrice.fast}`,color:'text-[#10B981]',icon:Zap},
              ].map((s,i) => (
                <div key={i} className="bg-black rounded-xl p-3 border border-[#1a1f2e] text-center">
                  <s.icon className={`w-3.5 h-3.5 mx-auto mb-1.5 ${s.color || ''}`} style={s.customColor ? {color:s.customColor} : {}}/>
                  <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5">{s.label}</div>
                  <div className={`text-sm font-bold font-mono ${s.color}`} style={s.customColor ? {color:s.customColor} : {}}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a1f2e] flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-2"><Crown className="w-4 h-4 text-[#F59E0B]"/>Top Tokens</span>
                <div className="flex gap-1">
                  {['MCap','24h','Vol'].map((s,i) => (
                    <button key={s} className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold ${i===0?'bg-[#0A1EFF]/10 text-[#0A1EFF]':'text-gray-600 hover:text-gray-400'}`}>{s}</button>
                  ))}
                </div>
              </div>
              {loading ? <div className="p-10 text-center text-gray-600 text-xs">Loading terminal data...</div> : (
                <div className="divide-y divide-[#1a1f2e]/50">
                  {topTokens.filter(t => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.symbol?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 15).map((t, i) => (
                    <div key={t.id} className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-white/[0.02] ${selectedToken?.id === t.id ? 'bg-[#0A1EFF]/[0.03]' : ''}`}
                      onClick={() => setSelectedToken(selectedToken?.id === t.id ? null : t)}>
                      <span className="text-[9px] text-gray-700 w-5 text-center font-mono">{t.rank||i+1}</span>
                      {t.image && <img src={t.image} alt="" className="w-7 h-7 rounded-full"/>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold">{t.symbol}</span>
                          <span className="text-[9px] text-gray-600 truncate">{t.name}</span>
                        </div>
                        <div className="text-[8px] text-gray-700 mt-0.5">MCap {fmt(t.marketCap)}</div>
                      </div>
                      <div className="w-16"><Spark data={t.sparkline} positive={(t.priceChange24h||0)>=0}/></div>
                      <div className="text-right w-20">
                        <div className="text-[11px] font-semibold font-mono">{fmtP(t.price)}</div>
                        <div className={`text-[9px] font-semibold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>
                          {(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%
                        </div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();toggleWatchlist(t.id)}} className="ml-1 p-1">
                        <Star className={`w-3.5 h-3.5 ${watchlist.includes(t.id)?'text-[#F59E0B] fill-[#F59E0B]':'text-gray-800 hover:text-gray-600'}`}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedToken && (
              <div className="bg-[#0f1320] rounded-2xl border border-[#0A1EFF]/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {selectedToken.image && <img src={selectedToken.image} alt="" className="w-8 h-8 rounded-full"/>}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{selectedToken.symbol}</span>
                      <span className="text-[10px] text-gray-500">{selectedToken.name}</span>
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5">Rank #{selectedToken.rank}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono">{fmtP(selectedToken.price)}</div>
                    <div className={`text-[10px] font-semibold ${(selectedToken.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>
                      {(selectedToken.priceChange24h||0)>=0?'+':''}{(selectedToken.priceChange24h||0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {[
                    {l:'1h',v:selectedToken.priceChange1h},{l:'24h',v:selectedToken.priceChange24h},{l:'7d',v:selectedToken.priceChange7d},
                    {l:'High',v:0,d:fmtP(selectedToken.high24h)},{l:'Low',v:0,d:fmtP(selectedToken.low24h)}
                  ].map((s,i)=>(
                    <div key={i} className="bg-[#060A12] rounded-lg p-2 text-center">
                      <div className="text-[8px] text-gray-600 uppercase mb-0.5">{s.l}</div>
                      {s.d ? <div className="text-[10px] font-semibold font-mono">{s.d}</div> :
                      <div className={`text-[10px] font-bold ${(s.v||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(s.v||0)>=0?'+':''}{(s.v||0).toFixed(2)}%</div>}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#060A12] rounded-lg p-2.5 text-center"><div className="text-[8px] text-gray-600 mb-0.5">MCap</div><div className="text-[11px] font-semibold">{fmt(selectedToken.marketCap)}</div></div>
                  <div className="bg-[#060A12] rounded-lg p-2.5 text-center"><div className="text-[8px] text-gray-600 mb-0.5">Volume</div><div className="text-[11px] font-semibold">{fmt(selectedToken.volume)}</div></div>
                  <div className="bg-[#060A12] rounded-lg p-2.5 text-center"><div className="text-[8px] text-gray-600 mb-0.5">Rank</div><div className="text-[11px] font-semibold">#{selectedToken.rank}</div></div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setShowChart(true)} className="bg-[#7C3AED] py-2.5 rounded-xl text-[11px] font-bold hover:bg-[#7C3AED]/80 transition-colors flex items-center justify-center gap-1.5 col-span-1">
                    <CandlestickChart className="w-3.5 h-3.5"/>Chart
                  </button>
                  <button className="bg-[#10B981] py-2.5 rounded-xl text-[11px] font-bold hover:bg-[#10B981]/80 transition-colors flex items-center justify-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5"/>Buy
                  </button>
                  <button className="bg-[#EF4444] py-2.5 rounded-xl text-[11px] font-bold hover:bg-[#EF4444]/80 transition-colors flex items-center justify-center gap-1.5">
                    <ArrowDownRight className="w-3.5 h-3.5"/>Sell
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
                <div className="text-[10px] font-bold mb-3 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-[#F59E0B]"/>Hot Right Now</div>
                {trending.slice(0,5).map((t,i)=>(
                  <div key={t.id||i} className="flex items-center gap-2.5 py-1.5">
                    {t.thumb?<img src={t.thumb} alt="" className="w-5 h-5 rounded-full"/>:<div className="w-5 h-5 rounded-full bg-gray-800"/>}
                    <span className="text-[10px] font-semibold flex-1 truncate">{t.symbol}</span>
                    <span className={`text-[9px] font-bold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
                <div className="text-[10px] font-bold mb-3 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-[#0A1EFF]"/>New Listings</div>
                {newPairs.slice(0,5).map((p,i)=>(
                  <div key={i} className="flex items-center gap-2.5 py-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center overflow-hidden">
                      {p.icon?<img src={p.icon} alt="" className="w-full h-full object-cover"/>:<Hash className="w-2.5 h-2.5 text-gray-600"/>}
                    </div>
                    <span className="text-[9px] font-mono text-gray-500 flex-1 truncate">{p.address?.slice(0,6)}...{p.address?.slice(-3)}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 uppercase">{p.chain?.slice(0,3)}</span>
                  </div>
                ))}
                {newPairs.length === 0 && <div className="text-[9px] text-gray-700 text-center py-6">Scanning DEXes...</div>}
              </div>
            </div>

            {watchlist.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl border border-[#F59E0B]/10 p-4">
                <div className="text-[10px] font-bold mb-3 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-[#F59E0B]"/>Watchlist ({watchlist.length})</div>
                <div className="space-y-1.5">
                  {topTokens.filter(t => watchlist.includes(t.id)).map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-1.5">
                      {t.image && <img src={t.image} alt="" className="w-5 h-5 rounded-full"/>}
                      <span className="text-[10px] font-semibold flex-1">{t.symbol}</span>
                      <span className="text-[10px] font-mono">{fmtP(t.price)}</span>
                      <span className={`text-[9px] font-bold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trending' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold flex items-center gap-1.5"><Flame className="w-4 h-4 text-[#F59E0B]"/>Trending Tokens</span>
              <span className="text-[9px] text-gray-600">CoinGecko Live</span>
            </div>
            {loading ? <div className="space-y-3">{[...Array(6)].map((_,i)=><div key={i} className="h-16 bg-[#0f1320] rounded-2xl animate-pulse"/>)}</div> : (
              trending.filter(t => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.symbol?.toLowerCase().includes(searchQuery.toLowerCase())).map((t,i) => (
                <div key={t.id||i} className="bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e] hover:border-[#0A1EFF]/15 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {t.thumb?<img src={t.thumb} alt="" className="w-9 h-9 rounded-full ring-1 ring-[#1a1f2e]"/>:<div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center text-[10px] font-bold">{t.symbol?.slice(0,2)}</div>}
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#060A12] rounded-full flex items-center justify-center border border-[#1a1f2e]"><span className="text-[7px] font-bold text-gray-500">{i+1}</span></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5"><span className="text-[11px] font-bold">{t.symbol}</span><span className="text-[9px] text-gray-600 truncate">{t.name}</span></div>
                      <div className="flex items-center gap-2 text-[8px] text-gray-600 mt-0.5">
                        {t.marketCapRank && <span>Rank #{t.marketCapRank}</span>}
                        <span>Score {(t.score||0)+1}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-bold">{t.marketCap || '-'}</div>
                      <div className={`text-[10px] font-semibold ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%</div>
                    </div>
                    <button onClick={()=>toggleWatchlist(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1"><Star className={`w-3.5 h-3.5 ${watchlist.includes(t.id)?'text-[#F59E0B] fill-[#F59E0B]':'text-gray-700'}`}/></button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-4">
            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-5">
              <div className="text-xs font-bold mb-2 flex items-center gap-2"><ScanLine className="w-4 h-4 text-[#0A1EFF]"/>Token Scanner</div>
              <p className="text-[10px] text-gray-500 mb-4">Paste any contract address to fetch real token data: price, liquidity, holders, security audit</p>
              <div className="flex gap-2 mb-3">
                <input type="text" value={pasteCA} onChange={e=>setPasteCA(e.target.value)} placeholder="Paste contract address (0x... or So1...)" className="flex-1 bg-[#060A12] border border-[#1a1f2e] rounded-xl px-4 py-2.5 text-[11px] font-mono text-white focus:outline-none focus:border-[#0A1EFF]/40"/>
                <button onClick={() => { if (pasteCA) lookupCA(pasteCA, selectedChain); }} disabled={caLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl text-[10px] font-bold disabled:opacity-50 flex items-center gap-1.5">
                  {caLoading ? <RotateCcw className="w-3 h-3 animate-spin"/> : <ScanLine className="w-3 h-3"/>}
                  Scan
                </button>
              </div>
              <div className="flex gap-1.5">
                {['ETH','SOL','BSC','BASE','ARB','POLY'].map(c => (
                  <button key={c} onClick={() => setSelectedChain(c)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold transition-all ${selectedChain === c ? 'bg-[#0A1EFF]/10 text-[#0A1EFF] border border-[#0A1EFF]/30' : 'text-gray-600 border border-transparent hover:text-gray-400'}`}>{c}</button>
                ))}
              </div>
            </div>

            {caLoading && !caResult && (
              <div className="bg-[#0f1320] rounded-2xl border border-[#0A1EFF]/20 p-8 text-center">
                <RotateCcw className="w-8 h-8 text-[#0A1EFF] mx-auto mb-3 animate-spin"/>
                <div className="text-sm font-bold mb-1">Scanning Contract...</div>
                <div className="text-[10px] text-gray-500">Fetching token data, liquidity, and security audit</div>
              </div>
            )}

            {caError && !caResult && !caLoading && (
              <div className="bg-[#EF4444]/5 rounded-2xl border border-[#EF4444]/20 p-4 text-center">
                <XCircle className="w-8 h-8 text-[#EF4444] mx-auto mb-2"/>
                <div className="text-sm font-bold text-[#EF4444] mb-1">Token Not Found</div>
                <div className="text-[10px] text-gray-500">{caError}</div>
              </div>
            )}

            {caResult && caResult.token && (
              <div className="space-y-4">
                <div className="bg-[#0f1320] rounded-2xl border border-[#0A1EFF]/20 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    {caResult.token.image && <img src={caResult.token.image} alt="" className="w-10 h-10 rounded-full"/>}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold">{caResult.token.symbol}</span>
                        <span className="text-[10px] text-gray-500">{caResult.token.name}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 uppercase">{caResult.token.chain}</span>
                      </div>
                      <div className="text-[9px] text-gray-600 font-mono mt-0.5">{caResult.token.address.slice(0,8)}...{caResult.token.address.slice(-6)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono">{fmtP(caResult.token.price)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      {l:'5m',v:caResult.token.priceChange5m},{l:'1h',v:caResult.token.priceChange1h},
                      {l:'6h',v:caResult.token.priceChange6h},{l:'24h',v:caResult.token.priceChange24h},
                    ].map(s=>(
                      <div key={s.l} className="bg-[#060A12] rounded-lg p-2.5 text-center">
                        <div className="text-[8px] text-gray-600 uppercase mb-0.5">{s.l}</div>
                        <div className={`text-[11px] font-bold ${(s.v||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>{(s.v||0)>=0?'+':''}{(s.v||0).toFixed(2)}%</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-[#060A12] rounded-lg p-3 text-center">
                      <div className="text-[8px] text-gray-600 uppercase mb-0.5">Liquidity</div>
                      <div className="text-sm font-bold text-[#0A1EFF]">{fmt(caResult.token.liquidity)}</div>
                    </div>
                    <div className="bg-[#060A12] rounded-lg p-3 text-center">
                      <div className="text-[8px] text-gray-600 uppercase mb-0.5">Market Cap</div>
                      <div className="text-sm font-bold text-[#7C3AED]">{fmt(caResult.token.marketCap)}</div>
                    </div>
                    <div className="bg-[#060A12] rounded-lg p-3 text-center">
                      <div className="text-[8px] text-gray-600 uppercase mb-0.5">24h Volume</div>
                      <div className="text-sm font-bold text-[#F59E0B]">{fmt(caResult.token.volume24h)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-[#060A12] rounded-lg p-3 text-center">
                      <div className="text-[8px] text-gray-600 uppercase mb-0.5">FDV</div>
                      <div className="text-[11px] font-semibold">{fmt(caResult.token.fdv)}</div>
                    </div>
                    <div className="bg-[#060A12] rounded-lg p-3 text-center">
                      <div className="text-[8px] text-gray-600 uppercase mb-0.5">DEX</div>
                      <div className="text-[11px] font-semibold capitalize">{caResult.token.dexId}</div>
                    </div>
                    <div className="bg-[#060A12] rounded-lg p-3 text-center">
                      <div className="text-[8px] text-gray-600 uppercase mb-0.5">Created</div>
                      <div className="text-[11px] font-semibold">{caResult.token.createdAt ? new Date(caResult.token.createdAt).toLocaleDateString() : '-'}</div>
                    </div>
                  </div>

                  <div className="bg-[#060A12] rounded-lg p-3 mb-4">
                    <div className="text-[9px] font-bold mb-2 text-gray-400">Transaction Activity</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {l:'1h',b:caResult.token.txns1h.buys,s:caResult.token.txns1h.sells},
                        {l:'6h',b:caResult.token.txns6h.buys,s:caResult.token.txns6h.sells},
                        {l:'24h',b:caResult.token.txns24h.buys,s:caResult.token.txns24h.sells},
                      ].map(t=>{
                        const total = t.b + t.s || 1;
                        return (
                          <div key={t.l}>
                            <div className="text-[8px] text-gray-600 text-center mb-1">{t.l}</div>
                            <div className="h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden flex">
                              <div className="bg-[#10B981] h-full rounded-l-full" style={{width:`${(t.b/total)*100}%`}}/>
                              <div className="bg-[#EF4444] h-full rounded-r-full" style={{width:`${(t.s/total)*100}%`}}/>
                            </div>
                            <div className="flex justify-between mt-1 text-[8px]">
                              <span className="text-[#10B981]">{t.b}B</span>
                              <span className="text-[#EF4444]">{t.s}S</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {caResult.token.url && (
                    <a href={caResult.token.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 bg-[#0A1EFF]/5 border border-[#0A1EFF]/20 rounded-xl text-[10px] text-[#0A1EFF] font-semibold hover:bg-[#0A1EFF]/10 transition-colors">
                      <ExternalLink className="w-3 h-3"/>View on DexScreener
                    </a>
                  )}
                </div>

                {!caResult.security && caResult.token && (
                  <div className="bg-[#0f1320] rounded-2xl border border-[#F59E0B]/20 p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0"/>
                    <div>
                      <div className="text-[11px] font-bold text-[#F59E0B]">Security Data Unavailable</div>
                      <div className="text-[9px] text-gray-500">GoPlus security scanning is not available for {caResult.token.chain || 'this chain'}. Always DYOR before trading.</div>
                    </div>
                  </div>
                )}

                {caResult.security && (
                  <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-5">
                    <div className="text-xs font-bold mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-[#10B981]"/>Security Audit</div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <SecurityBadge pass={!caResult.security.isHoneypot} label={caResult.security.isHoneypot ? 'Honeypot Detected!' : 'Not a Honeypot'} />
                      <SecurityBadge pass={caResult.security.isOpenSource} label={caResult.security.isOpenSource ? 'Open Source' : 'Not Open Source'} />
                      <SecurityBadge pass={!caResult.security.isMintable} label={caResult.security.isMintable ? 'Mintable' : 'Not Mintable'} />
                      <SecurityBadge pass={caResult.security.ownershipRenounced} label={caResult.security.ownershipRenounced ? 'Ownership Renounced' : 'Owner Active'} />
                      <SecurityBadge pass={!caResult.security.isProxy} label={caResult.security.isProxy ? 'Proxy Contract' : 'No Proxy'} />
                      <SecurityBadge pass={!caResult.security.hasBlacklist} label={caResult.security.hasBlacklist ? 'Has Blacklist' : 'No Blacklist'} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-[#060A12] rounded-lg p-3">
                        <div className="text-[8px] text-gray-600 uppercase mb-1">Buy Tax</div>
                        <div className={`text-sm font-bold ${caResult.security.buyTax > 5 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{caResult.security.buyTax.toFixed(1)}%</div>
                      </div>
                      <div className="bg-[#060A12] rounded-lg p-3">
                        <div className="text-[8px] text-gray-600 uppercase mb-1">Sell Tax</div>
                        <div className={`text-sm font-bold ${caResult.security.sellTax > 5 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{caResult.security.sellTax.toFixed(1)}%</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-[#060A12] rounded-lg p-3">
                        <div className="text-[8px] text-gray-600 uppercase mb-1">Holders</div>
                        <div className="text-sm font-bold">{caResult.security.holderCount.toLocaleString()}</div>
                      </div>
                      <div className="bg-[#060A12] rounded-lg p-3">
                        <div className="text-[8px] text-gray-600 uppercase mb-1">LP Holders</div>
                        <div className="text-sm font-bold">{caResult.security.lpHolderCount.toLocaleString()}</div>
                      </div>
                    </div>

                    {caResult.security.topHolders.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold mb-2 text-gray-400">Top Holders</div>
                        <div className="space-y-1">
                          {caResult.security.topHolders.slice(0,5).map((h,i) => (
                            <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-[#060A12] rounded-lg">
                              <span className="text-[9px] text-gray-700 w-4">{i+1}</span>
                              <span className="text-[9px] font-mono text-gray-500 flex-1 truncate">{h.address.slice(0,6)}...{h.address.slice(-4)}</span>
                              <div className="flex items-center gap-1.5">
                                {h.isLocked && <Lock className="w-2.5 h-2.5 text-[#10B981]"/>}
                                {h.isContract && <Cpu className="w-2.5 h-2.5 text-[#7C3AED]"/>}
                                <span className="text-[10px] font-bold">{h.percent}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {caResult.pairs.length > 1 && (
                  <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
                    <div className="text-[10px] font-bold mb-3 flex items-center gap-2"><ArrowLeftRight className="w-3.5 h-3.5 text-[#7C3AED]"/>Available Pairs</div>
                    {caResult.pairs.map((p,i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1a1f2e]/30 last:border-0">
                        <span className="text-[10px] font-semibold flex-1">{p.pair}</span>
                        <span className="text-[9px] capitalize text-gray-500">{p.dex}</span>
                        <span className="text-[9px] text-gray-500">{p.chain}</span>
                        <span className="text-[10px] font-mono">${p.price}</span>
                        <span className="text-[9px] text-[#0A1EFF]">{fmt(p.liquidity)} liq</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!caResult && !caError && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {icon:Shield,title:'Honeypot Check',desc:'Detect honeypot & rug pull contracts',color:'text-[#10B981]',bg:'bg-[#10B981]/5'},
                    {icon:Droplets,title:'Liquidity Analysis',desc:'Pool depth, lock status, LP tokens',color:'text-[#0A1EFF]',bg:'bg-[#0A1EFF]/5'},
                    {icon:Users,title:'Holder Distribution',desc:'Top holders, whale concentration',color:'text-[#7C3AED]',bg:'bg-[#7C3AED]/5'},
                    {icon:Lock,title:'Contract Audit',desc:'Open source, proxy, mint functions',color:'text-[#F59E0B]',bg:'bg-[#F59E0B]/5'},
                  ].map((f,i) => (
                    <div key={i} className={`bg-[#0f1320] rounded-2xl p-4 border border-[#1a1f2e] ${f.bg}`}>
                      <f.icon className={`w-6 h-6 ${f.color} mb-2.5`}/>
                      <div className="text-[10px] font-bold mb-1">{f.title}</div>
                      <div className="text-[8px] text-gray-500">{f.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
                  <div className="text-[10px] font-bold mb-3 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-[#F59E0B]"/>Quick Checks</div>
                  {[
                    {l:'Buy/Sell Tax',v:'Detects hidden taxes',s:'✅'},
                    {l:'Ownership Renounced',v:'Contract ownership status',s:'✅'},
                    {l:'Blacklist Function',v:'Can addresses be blocked',s:'✅'},
                    {l:'Trading Cooldown',v:'Anti-bot mechanisms',s:'✅'},
                    {l:'Max TX Amount',v:'Transaction limits',s:'✅'},
                    {l:'Proxy Contract',v:'Upgradeable logic detection',s:'✅'},
                  ].map((c,i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2 border-b border-[#1a1f2e]/50 last:border-0">
                      <span className="text-[10px]">{c.s}</span>
                      <span className="text-[10px] font-semibold flex-1">{c.l}</span>
                      <span className="text-[8px] text-gray-600">{c.v}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'sniper' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#EF4444]/5 to-[#F59E0B]/5 rounded-2xl border border-[#EF4444]/10 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-[#EF4444] to-[#F59E0B] rounded-2xl flex items-center justify-center shadow-lg shadow-[#EF4444]/20">
                  <Target className="w-6 h-6"/>
                </div>
                <div>
                  <div className="text-base font-bold">Token Sniper</div>
                  <div className="text-[10px] text-gray-500">Auto-buy new tokens at launch with speed and precision</div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-gray-500 block mb-1.5 font-medium">Buy Amount (SOL)</label>
                  <input type="text" value={sniperSettings.amount} onChange={e=>setSniperSettings(p=>({...p,amount:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-[#0A1EFF]/40"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-1.5 font-medium">Slippage %</label>
                    <input type="text" value={sniperSettings.slippage} onChange={e=>setSniperSettings(p=>({...p,slippage:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-[#0A1EFF]/40"/>
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-1.5 font-medium">Priority Fee</label>
                    <select className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-xl px-4 py-3 text-sm text-white focus:outline-none appearance-none">
                      <option>Turbo (0.01)</option>
                      <option>Fast (0.005)</option>
                      <option>Normal (0.001)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="text-[10px] font-bold mb-3">Protection Settings</div>
              <div className="space-y-3">
                {[
                  {l:'Anti-MEV Protection',d:'Front-run protection via private mempool',k:'antiMev'},
                  {l:'Auto-Sell on Profit',d:'Automatically sell when target hit',k:'autoSell'},
                ].map((s,i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div><div className="text-[10px] font-semibold">{s.l}</div><div className="text-[8px] text-gray-600 mt-0.5">{s.d}</div></div>
                    <button onClick={()=>setSniperSettings(p=>({...p,[s.k]:!(p as any)[s.k]}))} className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${(sniperSettings as any)[s.k]?'bg-[#10B981]':'bg-gray-700'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${(sniperSettings as any)[s.k]?'translate-x-5':'translate-x-0'}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="text-[10px] font-bold mb-3">Take Profit / Stop Loss</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] text-[#10B981] block mb-1.5 font-medium">Take Profit %</label>
                  <input type="text" value={sniperSettings.takeProfit} onChange={e=>setSniperSettings(p=>({...p,takeProfit:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-xl px-4 py-3 text-sm font-mono text-[#10B981] focus:outline-none focus:border-[#10B981]/40"/>
                </div>
                <div>
                  <label className="text-[8px] text-[#EF4444] block mb-1.5 font-medium">Stop Loss %</label>
                  <input type="text" value={sniperSettings.stopLoss} onChange={e=>setSniperSettings(p=>({...p,stopLoss:e.target.value}))} className="w-full bg-[#060A12] border border-[#1a1f2e] rounded-xl px-4 py-3 text-sm font-mono text-[#EF4444] focus:outline-none focus:border-[#EF4444]/40"/>
                </div>
              </div>
            </div>

            <button className="w-full bg-gradient-to-r from-[#EF4444] to-[#F59E0B] py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-[#EF4444]/20">
              <Target className="w-4 h-4"/> Arm Sniper Bot
            </button>
            <p className="text-[8px] text-gray-600 text-center">Connect wallet to activate. Trading involves risk.</p>
          </div>
        )}

        {activeTab === 'pulse' && (
          <div className="space-y-4">
            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold">Fear & Greed Index</span>
                <span className="text-2xl font-bold font-mono" style={{color:fgC}}>{fearGreed.value}</span>
              </div>
              <div className="h-3 bg-gradient-to-r from-[#EF4444] via-[#F59E0B] to-[#10B981] rounded-full relative">
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-[#060A12]" style={{left:`${Math.min(95,Math.max(5,fgV))}%`}}/>
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-gray-600"><span>Extreme Fear</span><span className="font-semibold" style={{color:fgC}}>{fearGreed.classification}</span><span>Extreme Greed</span></div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="text-xs font-bold mb-3">Biggest Movers (24h)</div>
              {topTokens.slice().sort((a,b) => Math.abs(b.priceChange24h||0) - Math.abs(a.priceChange24h||0)).slice(0,10).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[#1a1f2e]/30 last:border-0">
                  {t.image && <img src={t.image} alt="" className="w-5 h-5 rounded-full"/>}
                  <span className="text-[10px] font-semibold flex-1">{t.symbol}</span>
                  <div className="w-16"><Spark data={t.sparkline} positive={(t.priceChange24h||0)>=0}/></div>
                  <span className={`text-[10px] font-bold w-16 text-right ${(t.priceChange24h||0)>=0?'text-[#10B981]':'text-[#EF4444]'}`}>
                    {(t.priceChange24h||0)>=0?'+':''}{(t.priceChange24h||0).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4 text-center">
                <div className="text-[8px] text-gray-600 uppercase mb-1.5">Total Market Cap</div>
                <div className="text-base font-bold text-[#0A1EFF]">{fmt(topTokens.reduce((s,t)=>s+(t.marketCap||0),0))}</div>
              </div>
              <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4 text-center">
                <div className="text-[8px] text-gray-600 uppercase mb-1.5">24h Volume</div>
                <div className="text-base font-bold text-[#7C3AED]">{fmt(topTokens.reduce((s,t)=>s+(t.volume||0),0))}</div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="text-xs font-bold mb-3">Market Dominance</div>
              {topTokens.slice(0,5).map(t => {
                const dom = topTokens.reduce((s,x)=>s+(x.marketCap||0),0);
                const pct = dom ? ((t.marketCap||0)/dom)*100 : 0;
                return (
                  <div key={t.id} className="mb-3">
                    <div className="flex items-center justify-between text-[9px] mb-1">
                      <span className="font-semibold flex items-center gap-1.5">{t.image && <img src={t.image} alt="" className="w-3.5 h-3.5 rounded-full"/>}{t.symbol}</span>
                      <span className="text-gray-500">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-full transition-all" style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'perps' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#7C3AED]/5 to-transparent rounded-2xl border border-[#7C3AED]/15 p-6 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-[#7C3AED] to-[#0A1EFF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#7C3AED]/20">
                <Layers className="w-7 h-7"/>
              </div>
              <h3 className="text-lg font-heading font-bold mb-2">Perpetual Futures</h3>
              <p className="text-[10px] text-gray-500 max-w-xs mx-auto mb-4">Up to 100x leverage. Cross-margin. Sub-second execution. AI-powered risk management.</p>
              <div className="grid grid-cols-4 gap-2 mb-4 max-w-xs mx-auto">
                {[{l:'Leverage',v:'100x'},{l:'Markets',v:'50+'},{l:'Fees',v:'0.02%'},{l:'Chains',v:'3'}].map(s=>(
                  <div key={s.l} className="bg-[#060A12] rounded-xl p-2.5"><div className="text-[8px] text-gray-600">{s.l}</div><div className="text-sm font-bold text-[#7C3AED]">{s.v}</div></div>
                ))}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full">
                <Clock className="w-3 h-3 text-[#F59E0B]"/><span className="text-[9px] text-[#F59E0B] font-semibold">Coming Q2 2026</span>
              </div>
            </div>
            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-4">
              <div className="text-[10px] font-bold mb-3">Features</div>
              {['Cross & Isolated Margin','Liquidation Shield (AI)','TP/SL, Trailing Stop, Iceberg','Real-time Funding Rates','VTX AI Position Sizing','Multi-chain Settlement'].map((f,i)=>(
                <div key={i} className="flex items-center gap-2.5 py-2 border-b border-[#1a1f2e]/50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]"/>
                  <span className="text-[10px] text-gray-300">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#EF4444]/5 to-[#F59E0B]/5 rounded-2xl border border-[#EF4444]/15 p-6 relative overflow-hidden">
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-[#EF4444]/20 rounded-full"><span className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse"/><span className="text-[8px] text-[#EF4444] font-bold">LIVE</span></div>
              <div className="w-14 h-14 bg-gradient-to-br from-[#EF4444] to-[#F59E0B] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#EF4444]/20">
                <Video className="w-7 h-7"/>
              </div>
              <h3 className="text-lg font-heading font-bold mb-2 text-center">Live Trading Streams</h3>
              <p className="text-[11px] text-gray-400 max-w-sm mx-auto mb-4 text-center leading-relaxed">
                Broadcast your trades live. Let your audience watch your screen in real-time, interact via chat, and copy your trades with one click. The first social trading live streaming platform built for crypto.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4 max-w-sm mx-auto">
                {[{l:'Stream Quality',v:'HD Live',icon:Camera},{l:'Chat',v:'Real-time',icon:MessageCircle},{l:'Copy Trading',v:'1-Click',icon:Copy}].map(s=>(
                  <div key={s.l} className="bg-[#060A12] rounded-xl p-3 text-center">
                    <s.icon className="w-4 h-4 text-[#EF4444] mx-auto mb-1.5"/>
                    <div className="text-[8px] text-gray-600 mb-0.5">{s.l}</div>
                    <div className="text-[10px] font-bold text-[#EF4444]">{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full">
                  <Clock className="w-3 h-3 text-[#F59E0B]"/><span className="text-[9px] text-[#F59E0B] font-semibold">Coming Q3 2026</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-5">
              <div className="text-xs font-bold mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#0A1EFF]"/>How Live Trading Works</div>
              {[
                {s:'1',t:'Set Up Your Stream',d:'Connect your STEINZ Terminal, choose which data to show on screen (chart, positions, PnL). Set stream title and tags.',c:'text-[#EF4444]',icon:Camera},
                {s:'2',t:'Go Live',d:'Hit the Go Live button. Your screen is broadcast in HD to all your followers. Audio supported for live commentary.',c:'text-[#F59E0B]',icon:Play},
                {s:'3',t:'Trade Transparently',d:'Every trade you execute is shown in real-time on stream. Viewers see your entries, exits, position sizes, and PnL. Full transparency.',c:'text-[#0A1EFF]',icon:Eye},
                {s:'4',t:'Interact with Viewers',d:'Live chat lets your audience ask questions, debate your thesis, and learn from your strategy in real-time. Build a community.',c:'text-[#7C3AED]',icon:MessageCircle},
                {s:'5',t:'Viewers Copy Your Trades',d:'Followers can enable 1-click copy trading with customizable risk controls (max per trade, stop loss, position sizing). They mirror your moves automatically.',c:'text-[#10B981]',icon:Copy},
                {s:'6',t:'Earn Revenue',d:'Monetize through subscriber tiers, viewer tips, and copy-trade performance fees. Top streamers earn passive income from their audience.',c:'text-[#F59E0B]',icon:DollarSign},
              ].map((step,i)=>(
                <div key={i} className="flex items-start gap-3 py-3 border-b border-[#1a1f2e]/50 last:border-0">
                  <div className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${step.c}`}>
                    <step.icon className="w-4 h-4"/>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[8px] font-bold ${step.c}`}>STEP {step.s}</span>
                      <span className="text-[11px] font-semibold">{step.t}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 leading-relaxed">{step.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-5">
              <div className="text-xs font-bold mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-[#F59E0B]"/>Streamer Benefits</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {title:'Subscriber Revenue',desc:'Monthly subscription tiers for exclusive access',icon:DollarSign,color:'text-[#10B981]'},
                  {title:'Copy Trade Fees',desc:'Earn % on profits generated for your copiers',icon:Percent,color:'text-[#0A1EFF]'},
                  {title:'Tips & Donations',desc:'Viewers can tip during live sessions',icon:Gift,color:'text-[#F59E0B]'},
                  {title:'Leaderboard Fame',desc:'Top streamers featured on platform homepage',icon:Trophy,color:'text-[#7C3AED]'},
                ].map((b,i) => (
                  <div key={i} className="bg-[#060A12] rounded-xl p-3.5">
                    <b.icon className={`w-5 h-5 ${b.color} mb-2`}/>
                    <div className="text-[10px] font-bold mb-0.5">{b.title}</div>
                    <div className="text-[8px] text-gray-500">{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0f1320] rounded-2xl border border-[#1a1f2e] p-5">
              <div className="text-xs font-bold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-[#0A1EFF]"/>Viewer Guide</div>
              <div className="space-y-3">
                {[
                  {q:'How do I watch a live stream?',a:'Navigate to the LIVE tab and browse active streams. Click any stream to join. No account needed to watch.'},
                  {q:'How does copy trading work?',a:'While watching a stream, enable "Copy Mode". Set your max allocation per trade, stop loss %, and position sizing. When the streamer makes a trade, it\'s automatically mirrored in your wallet.'},
                  {q:'Is copy trading safe?',a:'You control all risk parameters. Set maximum trade sizes, stop losses, and daily limits. You can disable copy trading at any time. All trades require wallet confirmation.'},
                  {q:'What does it cost?',a:'Watching streams is free. Copy trading has a small performance fee (set by the streamer, typically 5-10% of profits). You only pay on profitable trades.'},
                  {q:'Can I become a streamer?',a:'Yes! Any user can apply to become a verified streamer. You need a minimum trading history and passing a basic review. Apply through the Social Trading hub.'},
                ].map((faq,i) => (
                  <div key={i} className="bg-[#060A12] rounded-xl p-3.5">
                    <div className="text-[10px] font-bold mb-1 flex items-center gap-1.5"><Info className="w-3 h-3 text-[#0A1EFF]"/>{faq.q}</div>
                    <div className="text-[9px] text-gray-500 leading-relaxed pl-4.5">{faq.a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#060A12]/95 backdrop-blur-2xl border-t border-[#1a1f2e]">
        <div className="px-2 pt-1 pb-1 safe-area-bottom">
          <div className="grid grid-cols-5 gap-1">
            {[
              {id:'market',label:'Market',icon:BarChart3,color:'text-[#0A1EFF]'},
              {id:'alerts',label:'Alerts',icon:Bell,color:'text-[#F59E0B]'},
              {id:'scan',label:'Scan CA',icon:ScanLine,color:'text-[#10B981]'},
              {id:'portfolio',label:'Portfolio',icon:Wallet,color:'text-[#7C3AED]'},
              {id:'tools',label:'Tools',icon:Settings,color:'text-[#EF4444]'},
            ].map(tab => (
              <button key={tab.id} onClick={() => {
                setBottomTab(tab.id);
                if (tab.id === 'market') setActiveTab('terminal');
                if (tab.id === 'alerts') setActiveTab('pulse');
                if (tab.id === 'scan') setShowCAModal(true);
                if (tab.id === 'portfolio') setActiveTab('terminal');
              }}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                  bottomTab === tab.id ? `${tab.color} bg-white/5` : 'text-gray-700 hover:text-gray-500'
                }`}>
                <tab.icon className="w-4.5 h-4.5"/>
                <span className="text-[8px] font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 mb-2">
        <div className="bg-[#0f1320] rounded-xl p-3 border border-[#F59E0B]/10 flex items-center gap-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0"/>
          <span className="text-[8px] text-gray-500"><span className="text-[#F59E0B] font-bold">PREVIEW</span> Real data displayed. Trading features require wallet connection.</span>
        </div>
      </div>
    </div>
  );
}
