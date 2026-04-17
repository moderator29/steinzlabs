'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Fish, ArrowLeft, Star, Search, RefreshCw, Zap, TrendingUp, TrendingDown,
  Copy, Check, X, Clock, ExternalLink, Users, Activity, Crown, Radio,
  Settings2, Filter, AlertTriangle, Info,
} from 'lucide-react';
import type { WhaleProfile, WhaleFeedEvent, WhaleTier } from '@/app/api/whale-tracker/route';
import { addLocalNotification } from '@/lib/notifications';

const TIER_COLORS: Record<WhaleTier, string> = {
  MEGA: '#F59E0B', LARGE: '#8B5CF6', MID: '#0A1EFF', SMALL: '#6B7280',
};

const CHAIN_META: Record<string, { symbol: string; color: string }> = {
  solana:   { symbol: '◎',    color: '#9945FF' },
  ethereum: { symbol: 'ETH',  color: '#627EEA' },
  bsc:      { symbol: 'BNB',  color: '#F3BA2F' },
  base:     { symbol: 'BASE', color: '#0052FF' },
  arbitrum: { symbol: 'ARB',  color: '#12AAFF' },
  polygon:  { symbol: 'POL',  color: '#8247E5' },
  optimism: { symbol: 'OP',   color: '#FF0420' },
  avalanche:{ symbol: 'AVAX', color: '#E84142' },
  sui:      { symbol: 'SUI',  color: '#6FBCF0' },
  ton:      { symbol: 'TON',  color: '#0088CC' },
};

function TierBadge({ tier }: { tier: WhaleTier }) {
  const color = TIER_COLORS[tier];
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0"
      style={{ color, borderColor: color + '40', background: color + '15' }}>
      {tier}
    </span>
  );
}

function ChainPill({ chain }: { chain: string }) {
  const meta = CHAIN_META[chain] ?? { symbol: chain.slice(0, 3).toUpperCase(), color: '#6B7280' };
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: meta.color, background: meta.color + '20' }}>
      {meta.symbol}
    </span>
  );
}

type Tab = 'discover' | 'my-whales' | 'live-feed';
type SortKey = 'volume' | 'winRate' | 'pnl' | 'trades';


function VtxSummary({ whales }: { whales: WhaleProfile[] }) {
  const mega = whales.filter(w => w.tier === 'MEGA').length;
  const chainCounts = whales.reduce((a, w) => { a[w.chain] = (a[w.chain] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const dominant = Object.entries(chainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const avgWin = whales.length ? Math.round(whales.reduce((s, w) => s + w.winRate, 0) / whales.length) : 0;
  const chains = Object.keys(chainCounts).length;
  return (
    <div className="bg-[#0A1EFF]/[0.06] border border-[#0A1EFF]/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5 text-[#0A1EFF]" />
        <span className="text-xs font-bold text-[#0A1EFF]">VTX Intelligence Summary</span>
      </div>
      <p className="text-[11px] text-gray-300 leading-relaxed">
        Tracking <span className="text-white font-bold">{whales.length}</span> real traders across{' '}
        <span className="text-white font-bold">{chains}</span> chains.
        {mega > 0 && <> <span className="text-[#F59E0B] font-bold">{mega} MEGA</span> whale{mega > 1 ? 's' : ''} active.</>}
        {' '}Top chain: <span className="text-white font-bold">{dominant}</span>.
        Avg win rate: <span className="text-[#10B981] font-bold">{avgWin}%</span>.
      </p>
    </div>
  );
}

function FeedItem({ ev }: { ev: WhaleFeedEvent }) {
  const color = ev.action === 'buy' ? '#10B981' : ev.action === 'sell' ? '#EF4444' : '#6B7280';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
        {ev.action === 'buy' ? <TrendingUp className="w-3.5 h-3.5" style={{ color }} />
          : ev.action === 'sell' ? <TrendingDown className="w-3.5 h-3.5" style={{ color }} />
          : <Activity className="w-3.5 h-3.5" style={{ color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">
          {ev.whaleShort} <span className="text-gray-500 font-normal">·</span>{' '}
          <span style={{ color }}>{ev.action.toUpperCase()}</span> {ev.token}
        </div>
        <div className="text-[10px] text-gray-500">{ev.chain} · {ev.time}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold text-white">{ev.amountUsd}</div>
        {ev.explorerUrl && (
          <a href={ev.explorerUrl} target="_blank" rel="noopener noreferrer"
            className="p-1 rounded hover:bg-white/[0.06] transition-colors text-gray-600 hover:text-gray-300">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function CopyTradeFlow({ whale, onClose }: { whale: WhaleProfile; onClose: () => void }) {
  const router = useRouter();
  const chainMap: Record<string, string> = { ethereum: 'ethereum', solana: 'solana', polygon: 'polygon', arbitrum: 'arbitrum', base: 'base', bsc: 'bsc', optimism: 'optimism' };
  const whaleChain = chainMap[whale.chain?.toLowerCase()] || 'ethereum';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-sm bg-[#0D1117] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold">Copy Trade — {whale.name}</span>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-3 mb-4 text-[11px] text-[#EF4444]">
          Copy trading carries significant risk. You may lose your entire position. Not financial advice.
        </div>
        <div className="space-y-2 mb-4">
          {[['Volume (7d)', whale.volumeStr], ['Win Rate', `${whale.winRate}%`], ['PnL', whale.pnlStr], ['Trades', `${whale.trades}`]].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-gray-500">{k}</span><span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={() => {
              const topToken = whale.topTokens?.[0] || '';
              const params = new URLSearchParams({ chain: whaleChain, sellToken: 'native' });
              if (topToken) params.set('buyToken', topToken);
              router.push(`/dashboard/swap?${params}`);
            }}
            className="flex-1 py-3 bg-[#10B981] hover:bg-[#059669] rounded-xl text-sm font-bold transition-colors">
            Open Swap
          </button>
        </div>
      </div>
    </div>
  );
}

function WhaleProfileModal({ whale, watching, onWatch, onClose, onCopyTrade }: {
  whale: WhaleProfile; watching: boolean;
  onWatch: () => void; onClose: () => void; onCopyTrade: (w: WhaleProfile) => void;
}) {
  const meta = CHAIN_META[whale.chain] ?? { symbol: whale.chain, color: '#6B7280' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-md bg-[#0D1117] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0D1117] flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            {whale.featured && <Crown className="w-4 h-4 text-[#F59E0B]" />}
            <span className="text-sm font-bold">{whale.name}</span>
            <TierBadge tier={whale.tier} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onWatch}
              className="p-1.5 rounded-lg transition-colors"
              style={watching ? { background: '#F59E0B20', color: '#F59E0B' } : { background: '#ffffff08', color: '#6B7280' }}>
              <Star className="w-4 h-4" fill={watching ? '#F59E0B' : 'none'} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {([['Volume', whale.volumeStr, '#0A1EFF'], ['PnL', whale.pnlStr, whale.pnlPercent >= 0 ? '#10B981' : '#EF4444'],
               ['Win Rate', `${whale.winRate}%`, '#F59E0B'], ['Trades', `${whale.trades}`, '#8B5CF6']] as [string, string, string][]).map(([k, v, c]) => (
              <div key={k} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                <div className="text-lg font-bold" style={{ color: c }}>{v}</div>
                <div className="text-[10px] text-gray-500">{k}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {[['Chain', <ChainPill key="cp" chain={whale.chain} />], ['Address', <span key="addr" className="font-mono text-xs">{whale.shortAddress}</span>],
              ['Last Trade', whale.lastTradeTime], ['Tier', whale.tier]].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between items-center text-xs py-1.5 border-b border-white/[0.03]">
                <span className="text-gray-500">{k}</span><span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
          {whale.recentTokens.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 mb-1.5">Recent Tokens</div>
              <div className="flex flex-wrap gap-1.5">
                {whale.recentTokens.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-gray-300">{t}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => onCopyTrade(whale)}
              className="flex-1 py-2.5 bg-[#10B981] rounded-xl text-xs font-bold hover:bg-[#0ea571] transition-colors">
              Copy Trade
            </button>
            <a href={whale.explorerUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-xs text-gray-300 hover:bg-white/[0.08] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />View on {CHAIN_META[whale.chain]?.symbol ?? 'Explorer'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhaleCard({ whale, watching, onProfile, onCopy, onCopyTrade, onWatch, copied }: {
  whale: WhaleProfile; watching: boolean;
  onProfile: (w: WhaleProfile) => void; onCopy: (addr: string) => void;
  onCopyTrade: (w: WhaleProfile) => void; onWatch: (id: string) => void; copied: string | null;
}) {
  const positive = whale.pnlPercent >= 0;
  return (
    <div className={`bg-[#0D1117] border rounded-2xl p-4 hover:border-white/[0.12] transition-all cursor-pointer ${whale.featured ? 'border-[#F59E0B]/25' : 'border-white/[0.04]'}`}
      onClick={() => onProfile(whale)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {whale.featured && <Crown className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0" />}
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">{whale.name}</div>
            <button onClick={e => { e.stopPropagation(); onCopy(whale.address); }}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 font-mono">
              {whale.shortAddress}
              {copied === whale.address ? <Check className="w-2.5 h-2.5 text-[#10B981]" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onWatch(whale.id); }}
            className="p-1 rounded transition-colors"
            style={watching ? { color: '#F59E0B' } : { color: '#374151' }}>
            <Star className="w-3.5 h-3.5" fill={watching ? '#F59E0B' : 'none'} />
          </button>
          <ChainPill chain={whale.chain} />
          <TierBadge tier={whale.tier} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div><div className="text-sm font-bold text-white">{whale.volumeStr}</div><div className="text-[9px] text-gray-600">Volume</div></div>
        <div>
          <div className={`text-sm font-bold ${positive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {positive ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
            {whale.pnlStr}
          </div>
          <div className="text-[9px] text-gray-600">PnL</div>
        </div>
        <div><div className="text-sm font-bold">{whale.winRate}%</div><div className="text-[9px] text-gray-600">Win Rate</div></div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-gray-600">
          <Clock className="w-3 h-3" />{whale.lastTradeTime}
        </div>
        <div className="flex gap-1.5">
          <a href={whale.explorerUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="text-[10px] px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
            <ExternalLink className="w-2.5 h-2.5" />View
          </a>
          <button onClick={e => { e.stopPropagation(); onCopyTrade(whale); }}
            className="text-[10px] px-2.5 py-1 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-lg font-semibold hover:bg-[#10B981]/20 transition-colors">
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [minVol, setMinVol] = useState('20000');
  const [maxVol, setMaxVol] = useState('5000000');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [chains, setChains] = useState<Record<string, boolean>>({
    solana: true, ethereum: true, bsc: true, base: true,
    arbitrum: true, polygon: true, optimism: true,
  });

  const toggleChain = (c: string) => setChains(p => ({ ...p, [c]: !p[c] }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-sm bg-[#0D1117] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[#0A1EFF]" />
            <span className="text-sm font-bold">Whale Tracker Settings</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="text-[11px] font-semibold text-gray-400 mb-3 uppercase tracking-wider">Volume Range (USD)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Min Volume</label>
                <input value={minVol} onChange={e => setMinVol(e.target.value)} type="number"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0A1EFF]/50" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Max Volume</label>
                <input value={maxVol} onChange={e => setMaxVol(e.target.value)} type="number"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0A1EFF]/50" />
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-400 mb-3 uppercase tracking-wider">Chain Alerts</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(chains).map(([c, enabled]) => {
                const meta = CHAIN_META[c] ?? { symbol: c, color: '#6B7280' };
                return (
                  <button key={c} onClick={() => toggleChain(c)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all"
                    style={enabled
                      ? { borderColor: meta.color + '50', background: meta.color + '15', color: meta.color }
                      : { borderColor: '#ffffff10', background: 'transparent', color: '#4B5563' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: enabled ? meta.color : '#374151' }} />
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Push Notifications</div>
              <div className="text-[10px] text-gray-500">Alert when watched whale trades</div>
            </div>
            <button onClick={() => setAlertsEnabled(p => !p)}
              className={`w-10 h-5 rounded-full transition-all relative ${alertsEnabled ? 'bg-[#0A1EFF]' : 'bg-gray-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${alertsEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="bg-[#0A1EFF]/[0.06] border border-[#0A1EFF]/20 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-400">Settings are saved locally. Supabase sync coming in a future update.</p>
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 bg-[#0A1EFF] hover:bg-[#0818CC] rounded-xl text-sm font-bold transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WhaleTrackerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('discover');
  const [whales, setWhales] = useState<WhaleProfile[]>([]);
  const [featured, setFeatured] = useState<WhaleProfile[]>([]);
  const [feed, setFeed] = useState<WhaleFeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [chainFilter, setChainFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState<WhaleTier | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [watching, setWatching] = useState<string[]>([]);
  const [selectedWhale, setSelectedWhale] = useState<WhaleProfile | null>(null);
  const [copyTradeWallet, setCopyTradeWallet] = useState<WhaleProfile | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  // Track which MEGA whales have already triggered a notification in this session
  const notifiedMegaRef = useRef<Set<string>>(new Set());

  // Load watchlist from localStorage on mount
  useEffect(() => {
    try { setWatching(JSON.parse(localStorage.getItem('vtx_whale_watching') ?? '[]')); } catch { /* Malformed JSON — return default */ }
  }, []);

  const toggleWatch = useCallback((id: string) => {
    setWatching(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem('vtx_whale_watching', JSON.stringify(next)); } catch { /* localStorage unavailable — silently ignore */ }
      // Also persist to Supabase whale follow API (non-blocking)
      const isNowWatching = next.includes(id);
      fetch('/api/moneyRadar/follow', {
        method: isNowWatching ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whaleId: id }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const fetchData = useCallback(async (activeTab: Tab = tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whale-tracker?tab=${activeTab}&chain=${chainFilter}`);
      if (res.ok) {
        const json = await res.json() as { whales: WhaleProfile[]; feed: WhaleFeedEvent[]; featured: WhaleProfile[] };
        setWhales(json.whales ?? []);
        setFeed(json.feed ?? []);
        setFeatured(json.featured ?? []);

        // Notify once per session for newly seen MEGA-tier whales
        for (const whale of (json.whales ?? [])) {
          if (whale.tier !== 'MEGA') continue;
          const key = whale.address || whale.id;
          if (!key || notifiedMegaRef.current.has(key)) continue;
          notifiedMegaRef.current.add(key);
          addLocalNotification({
            type: 'whale_alert',
            title: `MEGA Whale: ${whale.name}`,
            message: `${whale.shortAddress} is active on ${whale.chain} — ${whale.volumeStr} volume tracked`,
          });
        }
      }
    } catch (err) {
      console.error('[whale-tracker] Fetch whales failed:', err);
    } finally { setLoading(false); }
  }, [tab, chainFilter]);

  useEffect(() => { fetchData('discover'); }, []);

  // Live Feed via SSE
  useEffect(() => {
    if (tab !== 'live-feed') {
      sseRef.current?.close();
      sseRef.current = null;
      setLiveConnected(false);
      return;
    }
    // Also fetch initial batch of feed events via REST
    fetchData('live-feed');

    const walletAddr = localStorage.getItem('wallet_address') || '';
    const sseParams = new URLSearchParams();
    if (walletAddr) sseParams.set('wallet', walletAddr);
    const es = new EventSource(`/api/stream/whale-alerts?${sseParams}`);
    sseRef.current = es;
    es.onopen = () => setLiveConnected(true);
    es.onerror = () => {
      setLiveConnected(false);
    };
    es.addEventListener('whale-alert', (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as WhaleFeedEvent;
        setFeed(prev => [ev, ...prev].slice(0, 100));
      } catch { /* Malformed JSON — return default */ }
    });
    es.onmessage = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as WhaleFeedEvent;
        setFeed(prev => [ev, ...prev].slice(0, 100));
      } catch { /* Malformed JSON — return default */ }
    };
    return () => { es.close(); setLiveConnected(false); };
  }, [tab]);

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t !== 'live-feed') fetchData(t);
  }

  function handleCopy(addr: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  }

  const availableChains = ['all', ...Array.from(new Set(whales.map(w => w.chain))).sort()];
  const TIERS: Array<WhaleTier | 'all'> = ['all', 'MEGA', 'LARGE', 'MID', 'SMALL'];

  const filtered = whales.filter(w => {
    if (tierFilter !== 'all' && w.tier !== tierFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return w.name.toLowerCase().includes(s) || w.address.toLowerCase().includes(s);
    }
    return true;
  }).sort((a, b) => {
    if (sortKey === 'winRate') return b.winRate - a.winRate;
    if (sortKey === 'pnl') return b.pnlPercent - a.pnlPercent;
    if (sortKey === 'trades') return b.trades - a.trades;
    return b.totalVolumeUsd - a.totalVolumeUsd;
  });

  const myWhales = whales.filter(w => watching.includes(w.id));

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#10B981] rounded-xl flex items-center justify-center">
            <Fish className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Whale Tracker</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-[#0A1EFF]/20 text-[#0A1EFF] border border-[#0A1EFF]/30 rounded font-bold">
                {whales.length > 0 ? `${whales.length}` : 'LIVE'}
              </span>
            </div>
            <span className="text-[10px] text-gray-600">Human traders · Multi-chain</span>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/[0.06] rounded-lg">
            <Settings2 className="w-4 h-4 text-gray-400" />
          </button>
          <button onClick={() => fetchData(tab)} disabled={loading} className="p-2 hover:bg-white/[0.06] rounded-lg disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex border-t border-white/[0.04]">
          {([['discover', 'Discover', Users], ['my-whales', 'My Whales', Star], ['live-feed', 'Live Feed', Radio]] as [Tab, string, React.ElementType][]).map(([t, label, Icon]) => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${tab === t ? 'border-[#0A1EFF] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
              {t === 'my-whales' && watching.length > 0 && (
                <span className="w-4 h-4 bg-[#F59E0B] text-black rounded-full text-[8px] font-bold flex items-center justify-center">{watching.length}</span>
              )}
              {t === 'live-feed' && liveConnected && <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── DISCOVER TAB ─────────────────────────────────────────── */}
        {tab === 'discover' && (
          <>
            {whales.length > 0 && <VtxSummary whales={whales} />}
            {featured.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="text-xs font-bold text-gray-300">Top Traders</span>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {featured.map(w => (
                    <div key={w.id} onClick={() => setSelectedWhale(w)}
                      className="flex-shrink-0 w-44 bg-[#0D1117] border border-[#F59E0B]/25 rounded-2xl p-3 cursor-pointer hover:border-[#F59E0B]/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-[#F59E0B]" /><ChainPill chain={w.chain} /></div>
                        <button onClick={e => { e.stopPropagation(); toggleWatch(w.id); }} className="p-0.5" style={watching.includes(w.id) ? { color: '#F59E0B' } : { color: '#374151' }}>
                          <Star className="w-3.5 h-3.5" fill={watching.includes(w.id) ? '#F59E0B' : 'none'} />
                        </button>
                      </div>
                      <div className="text-[11px] font-bold truncate mb-1">{w.name}</div>
                      <div className="text-sm font-bold text-[#10B981]">{w.pnlStr}</div>
                      <div className="text-[10px] text-gray-500">{w.winRate}% win · {w.volumeStr}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search + Filters */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or address…"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/50" />
                </div>
                <button onClick={() => setShowFilters(p => !p)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${showFilters ? 'bg-[#0A1EFF]/15 border-[#0A1EFF]/30 text-[#4D6BFF]' : 'bg-white/[0.04] border-white/[0.06] text-gray-400'}`}>
                  <Filter className="w-3.5 h-3.5" /><span className="hidden sm:inline">Filters</span>
                </button>
              </div>
              {showFilters && (
                <div className="space-y-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {availableChains.map(c => {
                      const meta = CHAIN_META[c];
                      return (
                        <button key={c} onClick={() => setChainFilter(c)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${chainFilter === c ? 'bg-[#0A1EFF] text-white' : 'bg-white/[0.04] text-gray-400'}`}
                          style={chainFilter === c && c !== 'all' && meta ? { background: meta.color + '25', color: meta.color } : {}}>
                          {c === 'all' ? 'All Chains' : (meta?.symbol ?? c)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    {TIERS.map(t => (
                      <button key={t} onClick={() => setTierFilter(t)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${tierFilter === t ? 'bg-white/[0.12] text-white' : 'bg-white/[0.04] text-gray-500'}`}
                        style={tierFilter === t && t !== 'all' ? { color: TIER_COLORS[t], background: TIER_COLORS[t] + '20' } : {}}>
                        {t === 'all' ? 'All Tiers' : t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {(['volume', 'winRate', 'pnl', 'trades'] as SortKey[]).map(s => (
                      <button key={s} onClick={() => setSortKey(s)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize ${sortKey === s ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30' : 'bg-white/[0.04] text-gray-500'}`}>
                        {s === 'winRate' ? 'Win Rate' : s === 'pnl' ? 'PnL' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {loading && <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" /></div>}

            {!loading && filtered.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500">{filtered.length} real traders</span>
                  <span className="text-[10px] text-gray-600">Sorted by {sortKey}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map(w => (
                    <WhaleCard key={w.id} whale={w} watching={watching.includes(w.id)}
                      onProfile={setSelectedWhale} onCopy={handleCopy}
                      onCopyTrade={setCopyTradeWallet} onWatch={toggleWatch} copied={copied} />
                  ))}
                </div>
              </div>
            )}
            {!loading && filtered.length === 0 && whales.length > 0 && (
              <div className="flex flex-col items-center py-10 gap-2">
                <Search className="w-8 h-8 text-gray-700" /><p className="text-sm text-gray-500">No whales match your filters</p>
              </div>
            )}
            {!loading && whales.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-2">
                <Fish className="w-8 h-8 text-gray-700" /><p className="text-sm text-gray-500">Whale tracker is scanning wallets across multiple chains. Large movements will appear as they are detected.</p>
                <button onClick={() => fetchData('discover')} className="text-xs px-3 py-1.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-lg text-[#4D6BFF] hover:bg-[#0A1EFF]/20 transition-colors mt-2">Refresh</button>
              </div>
            )}
          </>
        )}

        {/* ── MY WHALES TAB ────────────────────────────────────────── */}
        {tab === 'my-whales' && (
          <>
            {myWhales.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <Star className="w-10 h-10 text-gray-700" />
                <p className="text-sm font-semibold text-gray-500">No watched whales yet</p>
                <p className="text-[11px] text-gray-600 text-center max-w-xs">Go to Discover, click the ☆ star icon on any whale card to track them here.</p>
                <button onClick={() => handleTabChange('discover')} className="text-xs px-4 py-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 text-[#4D6BFF] rounded-xl hover:bg-[#0A1EFF]/20 transition-colors font-semibold">Browse Whales</button>
              </div>
            ) : (
              <>
                <VtxSummary whales={myWhales} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myWhales.map(w => (
                    <WhaleCard key={w.id} whale={w} watching={true}
                      onProfile={setSelectedWhale} onCopy={handleCopy}
                      onCopyTrade={setCopyTradeWallet} onWatch={toggleWatch} copied={copied} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── LIVE FEED TAB ─────────────────────────────────────────── */}
        {tab === 'live-feed' && (
          <>
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-xs font-bold text-gray-300">Live Whale Activity</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${liveConnected ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'bg-yellow-900/20 text-yellow-500 border border-yellow-900/30'}`}>
                {liveConnected ? 'LIVE' : 'POLLING'}
              </span>
            </div>
            {!liveConnected && (
              <div className="bg-yellow-900/10 border border-yellow-900/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-600">SSE stream initializing — showing latest on-chain transfers fetched via REST. Live stream will connect shortly.</p>
              </div>
            )}
            {feed.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <Activity className="w-8 h-8 text-gray-700 animate-pulse" />
                <p className="text-sm text-gray-500">Fetching whale activity…</p>
              </div>
            ) : (
              <div className="bg-[#0D1117] border border-white/[0.06] rounded-2xl divide-y divide-white/[0.04] px-4">
                {feed.map(ev => <FeedItem key={ev.id} ev={ev} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {selectedWhale && (
        <WhaleProfileModal whale={selectedWhale} watching={watching.includes(selectedWhale.id)}
          onWatch={() => toggleWatch(selectedWhale.id)} onClose={() => setSelectedWhale(null)}
          onCopyTrade={w => { setSelectedWhale(null); setCopyTradeWallet(w); }} />
      )}
      {copyTradeWallet && <CopyTradeFlow whale={copyTradeWallet} onClose={() => setCopyTradeWallet(null)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

