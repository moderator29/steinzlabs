'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Fish, ArrowLeft, Star, Search, RefreshCw, Zap, TrendingUp, TrendingDown, Copy, Check, X, Clock, ExternalLink, Users, Activity, Crown, Radio } from 'lucide-react';
import type { WhaleProfile, WhaleFeedEvent, WhaleTier } from '@/app/api/whale-tracker/route';

// ─── VTX Micro-Summary ────────────────────────────────────────────────────────

function VtxSummary({ whales }: { whales: WhaleProfile[] }) {
  const mega = whales.filter(w => w.tier === 'MEGA').length;
  const topChain = whales.reduce((acc, w) => { acc[w.chain] = (acc[w.chain] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const dominant = Object.entries(topChain).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
  const avgWin = whales.length ? Math.round(whales.reduce((s, w) => s + w.winRate, 0) / whales.length) : 0;
  return (
    <div className="bg-[#0A1EFF]/[0.06] border border-[#0A1EFF]/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5 text-[#0A1EFF]" />
        <span className="text-xs font-bold text-[#0A1EFF]">VTX Intelligence Summary</span>
      </div>
      <p className="text-[11px] text-gray-300 leading-relaxed">
        Tracking <span className="text-white font-bold">{whales.length}</span> active whale wallets across multiple chains.
        {mega > 0 && <> <span className="text-[#F59E0B] font-bold">{mega} MEGA</span> whales detected.</>}
        {' '}Dominant chain: <span className="text-white font-bold">{dominant}</span>.
        Average win rate: <span className="text-[#10B981] font-bold">{avgWin}%</span>.
      </p>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<WhaleTier, string> = {
  MEGA: '#F59E0B', LARGE: '#8B5CF6', MID: '#0A1EFF', SMALL: '#6B7280',
};

const CHAIN_EMOJI: Record<string, string> = {
  solana: '◎', ethereum: 'Ξ', bsc: 'BNB', base: 'B', arbitrum: 'ARB',
  polygon: 'MATIC', avalanche: 'AVAX', optimism: 'OP', sui: 'SUI', ton: 'TON',
};

// ─── Copy Trade Flow (15-sec confirmation) ────────────────────────────────────

function CopyTradeFlow({ whale, onClose }: { whale: WhaleProfile; onClose: () => void }) {
  const [countdown, setCountdown] = useState(15);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (confirmed || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, confirmed]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-sm bg-[#0D1117] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold">Copy Trade — {whale.name}</span>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        {!confirmed ? (
          <>
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-3 mb-4 text-[11px] text-[#EF4444]">
              ⚠️ Copy trading carries significant risk. You may lose your entire position. This is NOT financial advice.
            </div>
            <div className="space-y-2 mb-4">
              {[['Volume (7d)', whale.volumeStr], ['Win Rate', `${whale.winRate}%`], ['PnL', whale.pnlStr], ['Trades', whale.trades.toString()]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-500">{k}</span><span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#ffffff10" strokeWidth="3" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#10B981" strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - countdown / 15)}`}
                    className="transition-all duration-1000" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{countdown}</span>
              </div>
              <button disabled={countdown > 0} onClick={() => setConfirmed(true)}
                className="flex-1 py-3 bg-[#10B981] rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {countdown > 0 ? `Confirm in ${countdown}s` : 'Confirm Copy Trade'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-[#10B981]" />
            </div>
            <div className="text-sm font-bold text-[#10B981] mb-1">Copy Trade Active</div>
            <div className="text-[11px] text-gray-500">You are now paper-tracking {whale.shortAddress}</div>
            <button onClick={onClose} className="mt-4 text-xs text-gray-500 hover:text-gray-300">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Whale Profile Modal ──────────────────────────────────────────────────────

function WhaleProfileModal({ whale, onClose, onCopyTrade }: { whale: WhaleProfile; onClose: () => void; onCopyTrade: (w: WhaleProfile) => void }) {
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
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[['Volume', whale.volumeStr, '#0A1EFF'], ['PnL', whale.pnlStr, whale.pnlPercent >= 0 ? '#10B981' : '#EF4444'],
              ['Win Rate', `${whale.winRate}%`, '#F59E0B'], ['Trades', whale.trades.toString(), '#8B5CF6']].map(([k, v, c]) => (
              <div key={k} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                <div className="text-lg font-bold" style={{ color: c }}>{v}</div>
                <div className="text-[10px] text-gray-500">{k}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {[['Chain', CHAIN_EMOJI[whale.chain] + ' ' + whale.chain], ['Address', whale.shortAddress],
              ['Last Trade', whale.lastTradeTime], ['Tier', whale.tier]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs py-1.5 border-b border-white/[0.03]">
                <span className="text-gray-500">{k}</span><span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onCopyTrade(whale)}
              className="flex-1 py-2.5 bg-[#10B981] rounded-xl text-xs font-bold">Copy Trade</button>
            <a href={`https://solscan.io/account/${whale.address}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-xs text-gray-300 hover:bg-white/[0.08] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />View
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: WhaleTier }) {
  const color = TIER_COLORS[tier];
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
      style={{ color, borderColor: color + '40', background: color + '15' }}>
      {tier}
    </span>
  );
}

// ─── Live Feed Item ───────────────────────────────────────────────────────────

function FeedItem({ ev }: { ev: WhaleFeedEvent }) {
  const color = ev.action === 'buy' ? '#10B981' : ev.action === 'sell' ? '#EF4444' : '#6B7280';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04]">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: color + '20' }}>
        {ev.action === 'buy' ? <TrendingUp className="w-3.5 h-3.5" style={{ color }} />
          : ev.action === 'sell' ? <TrendingDown className="w-3.5 h-3.5" style={{ color }} />
          : <Activity className="w-3.5 h-3.5" style={{ color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{ev.whaleShort} <span className="text-gray-500 font-normal">·</span> <span style={{ color }}>{ev.action.toUpperCase()}</span> {ev.token}</div>
        <div className="text-[10px] text-gray-500">{ev.chain} · {ev.time}</div>
      </div>
      <div className="text-xs font-bold text-white">{ev.amountUsd}</div>
    </div>
  );
}

// ─── Whale Card ───────────────────────────────────────────────────────────────

function WhaleCard({ whale, onProfile, onCopy, onCopyTrade, copied }: {
  whale: WhaleProfile;
  onProfile: (w: WhaleProfile) => void;
  onCopy: (addr: string) => void;
  onCopyTrade: (w: WhaleProfile) => void;
  copied: string | null;
}) {
  const positive = whale.pnlPercent >= 0;
  return (
    <div className={`bg-[#0D1117] border rounded-2xl p-4 hover:border-white/[0.12] transition-all cursor-pointer ${whale.featured ? 'border-[#F59E0B]/25' : 'border-white/[0.04]'}`}
      onClick={() => onProfile(whale)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {whale.featured && <Crown className="w-3.5 h-3.5 text-[#F59E0B]" />}
          <div>
            <div className="text-xs font-bold">{whale.name}</div>
            <button onClick={e => { e.stopPropagation(); onCopy(whale.address); }}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 font-mono">
              {whale.shortAddress}
              {copied === whale.address ? <Check className="w-2.5 h-2.5 text-[#10B981]" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 font-mono">{CHAIN_EMOJI[whale.chain] ?? whale.chain}</span>
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
        <button onClick={e => { e.stopPropagation(); onCopyTrade(whale); }}
          className="text-[10px] px-2.5 py-1 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-lg font-semibold hover:bg-[#10B981]/20 transition-colors">
          Copy Trade
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'discover' | 'my-whales' | 'live-feed';

export default function WhaleTrackerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('discover');
  const [whales, setWhales] = useState<WhaleProfile[]>([]);
  const [featured, setFeatured] = useState<WhaleProfile[]>([]);
  const [feed, setFeed] = useState<WhaleFeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [chain, setChain] = useState('all');
  const [tierFilter, setTierFilter] = useState<WhaleTier | 'all'>('all');
  const [watching, setWatching] = useState<string[]>([]);
  const [selectedWhale, setSelectedWhale] = useState<WhaleProfile | null>(null);
  const [copyTradeWallet, setCopyTradeWallet] = useState<WhaleProfile | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    try { setWatching(JSON.parse(localStorage.getItem('vtx_watching') ?? '[]')); } catch { /* ignore */ }
  }, []);

  const toggleWatch = useCallback((id: string) => {
    setWatching(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('vtx_watching', JSON.stringify(next));
      return next;
    });
  }, []);

  const fetchData = useCallback(async (activeTab: Tab = tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whale-tracker?tab=${activeTab}`);
      if (res.ok) {
        const json = await res.json() as { whales: WhaleProfile[]; feed: WhaleFeedEvent[]; featured: WhaleProfile[] };
        setWhales(json.whales ?? []);
        setFeed(json.feed ?? []);
        setFeatured(json.featured ?? []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchData('discover'); }, []);

  useEffect(() => {
    if (tab !== 'live-feed') { sseRef.current?.close(); sseRef.current = null; setLiveConnected(false); return; }
    const es = new EventSource('/api/stream/whale-alerts');
    sseRef.current = es;
    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);
    es.onmessage = (e) => {
      try { const ev = JSON.parse(e.data) as WhaleFeedEvent; setFeed(prev => [ev, ...prev].slice(0, 100)); } catch { /* ignore */ }
    };
    return () => { es.close(); setLiveConnected(false); };
  }, [tab]);

  function handleTabChange(t: Tab) { setTab(t); if (t !== 'live-feed') fetchData(t); }

  function handleCopy(addr: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  }

  const chains = ['all', ...Array.from(new Set(whales.map(w => w.chain))).sort()];
  const TIERS: Array<WhaleTier | 'all'> = ['all', 'MEGA', 'LARGE', 'MID', 'SMALL'];

  const filtered = whales.filter(w => {
    if (chain !== 'all' && w.chain !== chain) return false;
    if (tierFilter !== 'all' && w.tier !== tierFilter) return false;
    if (search) { const s = search.toLowerCase(); return w.name.toLowerCase().includes(s) || w.address.toLowerCase().includes(s); }
    return true;
  });

  const myWhales = whales.filter(w => watching.includes(w.id));

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
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
              <span className="text-[9px] px-1.5 py-0.5 bg-[#0A1EFF]/20 text-[#0A1EFF] border border-[#0A1EFF]/30 rounded font-bold">1000+</span>
            </div>
            <span className="text-[10px] text-gray-600">Multi-chain whale intelligence</span>
          </div>
          <button onClick={() => fetchData(tab)} disabled={loading} className="p-2 hover:bg-white/[0.06] rounded-lg disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex border-t border-white/[0.04]">
          {([['discover', 'Discover', Users], ['my-whales', 'My Whales', Star], ['live-feed', 'Live Feed', Radio]] as [Tab, string, React.ElementType][]).map(([t, label, Icon]) => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${tab === t ? 'border-[#0A1EFF] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
              {t === 'live-feed' && liveConnected && <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* VTX Summary (discover only) */}
        {tab === 'discover' && whales.length > 0 && <VtxSummary whales={whales} />}

        {/* ── DISCOVER TAB ─────────────────────────────────────────── */}
        {tab === 'discover' && (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="text-xs font-bold text-gray-300">Featured Whales</span>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {featured.map(w => (
                    <div key={w.id} onClick={() => setSelectedWhale(w)}
                      className="flex-shrink-0 w-44 bg-[#0D1117] border border-[#F59E0B]/25 rounded-2xl p-3 cursor-pointer hover:border-[#F59E0B]/50 transition-colors">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Crown className="w-3 h-3 text-[#F59E0B]" />
                        <span className="text-[11px] font-bold truncate">{w.name}</span>
                      </div>
                      <div className="text-sm font-bold text-[#10B981]">{w.pnlStr}</div>
                      <div className="text-[10px] text-gray-500">{w.winRate}% win · {w.volumeStr}</div>
                      <button onClick={e => { e.stopPropagation(); toggleWatch(w.id); }}
                        className="mt-2 w-full text-[9px] py-1 rounded-lg border transition-colors"
                        style={watching.includes(w.id) ? { background: '#F59E0B20', borderColor: '#F59E0B40', color: '#F59E0B' } : { background: 'transparent', borderColor: '#ffffff10', color: '#6B7280' }}>
                        {watching.includes(w.id) ? '★ Watching' : '☆ Watch'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search + filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search whales…"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/50" />
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {chains.map(c => (
                  <button key={c} onClick={() => setChain(c)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${chain === c ? 'bg-[#0A1EFF] text-white' : 'bg-white/[0.04] text-gray-400'}`}>
                    {c === 'all' ? 'All Chains' : (CHAIN_EMOJI[c] ?? '') + ' ' + c}
                  </button>
                ))}
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
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Whale cards */}
            {!loading && filtered.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500">{filtered.length} whales</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map(w => (
                    <WhaleCard key={w.id} whale={w} onProfile={setSelectedWhale}
                      onCopy={handleCopy} onCopyTrade={setCopyTradeWallet} copied={copied} />
                  ))}
                </div>
              </div>
            )}

            {!loading && filtered.length === 0 && whales.length > 0 && (
              <div className="flex flex-col items-center py-10 gap-2">
                <Search className="w-8 h-8 text-gray-700" />
                <p className="text-sm text-gray-500">No whales match your filters</p>
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
                <p className="text-[11px] text-gray-600 text-center">Go to Discover and click Watch on a whale to track them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myWhales.map(w => (
                  <WhaleCard key={w.id} whale={w} onProfile={setSelectedWhale}
                    onCopy={handleCopy} onCopyTrade={setCopyTradeWallet} copied={copied} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── LIVE FEED TAB ─────────────────────────────────────────── */}
        {tab === 'live-feed' && (
          <>
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-xs font-bold text-gray-300">Live Whale Activity</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${liveConnected ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'bg-gray-800 text-gray-500'}`}>
                {liveConnected ? 'LIVE' : 'CONNECTING…'}
              </span>
            </div>
            {feed.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <Activity className="w-8 h-8 text-gray-700" />
                <p className="text-sm text-gray-500">Waiting for whale activity…</p>
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
        <WhaleProfileModal whale={selectedWhale} onClose={() => setSelectedWhale(null)}
          onCopyTrade={w => { setSelectedWhale(null); setCopyTradeWallet(w); }} />
      )}
      {copyTradeWallet && (
        <CopyTradeFlow whale={copyTradeWallet} onClose={() => setCopyTradeWallet(null)} />
      )}
    </div>
  );
}
