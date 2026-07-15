'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Coins, ShieldCheck, Star, Eye, EyeOff, Loader2, Search,
  DollarSign, Activity, TrendingUp,
} from 'lucide-react';

interface Coin {
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  name: string | null;
  logo_url: string | null;
  verified: boolean;
  featured: boolean;
  hidden: boolean;
  is_graduated: boolean;
  price_usd: number | null;
  market_cap_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  change_24h: number | null;
  holders_count: number | null;
  dex: string | null;
}

interface DayPoint { day: string; revenueUsd: number; volumeUsd: number; trades: number }
interface ChainPoint { chain: string; volumeUsd: number; revenueUsd: number; trades: number }
interface CoinPoint { chain: string; tokenKey: string; symbol: string | null; volumeUsd: number; revenueUsd: number; trades: number }

interface Revenue {
  estimated: boolean;
  basis: string;
  totalRevenueUsd: number;
  totalVolumeUsd: number;
  totalTrades: number;
  perChain: ChainPoint[];
  perDay: DayPoint[];
  topCoins: CoinPoint[];
}

type Filter = 'all' | 'verified' | 'featured' | 'hidden' | 'flagged';
type Action = 'verify' | 'unverify' | 'feature' | 'unfeature' | 'hide' | 'unhide';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'featured', label: 'Featured' },
  { key: 'flagged', label: 'Needs review' },
  { key: 'hidden', label: 'Hidden' },
];

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function fmtUsd(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(digits)}`;
}

function fmtPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(3)}`;
}

/** Inline SVG area chart of the per-day revenue series. No external deps. */
function RevenueChart({ series }: { series: DayPoint[] }) {
  const W = 640;
  const H = 120;
  const P = 6;
  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-xs text-gray-600">
        No revenue yet
      </div>
    );
  }
  const max = Math.max(...series.map(d => d.revenueUsd), 0.0001);
  const step = series.length > 1 ? (W - P * 2) / (series.length - 1) : 0;
  const pts = series.map((d, i) => {
    const x = P + i * step;
    const y = H - P - (d.revenueUsd / max) * (H - P * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - P} L${pts[0][0].toFixed(1)},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[120px]" preserveAspectRatio="none" role="img" aria-label="Daily estimated revenue">
      <defs>
        <linearGradient id="coinsRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0066FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#coinsRev)" />
      <path d={line} fill="none" stroke="#0066FF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function AdminCoinsPage() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const loadCoins = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/coins?filter=${f}`, { headers: authHeader() });
      const json = await res.json();
      setCoins(json.coins ?? []);
    } catch (err) {
      console.error('Failed to load coins:', err);
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRevenue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coins/revenue', { headers: authHeader() });
      setRevenue(await res.json());
    } catch (err) {
      console.error('Failed to load coins revenue:', err);
    }
  }, []);

  useEffect(() => { loadCoins(filter); }, [filter, loadCoins]);
  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  const act = async (coin: Coin, action: Action, field: 'verified' | 'featured' | 'hidden', next: boolean) => {
    const id = `${coin.chain}:${coin.token_key}`;
    setBusy(id);
    setCoins(prev => prev.map(c => (`${c.chain}:${c.token_key}` === id ? { ...c, [field]: next } : c)));
    try {
      const res = await fetch('/api/admin/coins', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ chain: coin.chain, tokenKey: coin.token_key, action }),
      });
      if (!res.ok) throw new Error('request failed');
    } catch (err) {
      console.error('Coin action failed:', err);
      setCoins(prev => prev.map(c => (`${c.chain}:${c.token_key}` === id ? { ...c, [field]: !next } : c)));
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coins;
    return coins.filter(c =>
      [c.symbol, c.name, c.chain, c.token_address].some(v => v?.toLowerCase().includes(q)),
    );
  }, [coins, query]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#0066FF]/10 flex items-center justify-center flex-shrink-0">
          <Coins className="w-4.5 h-4.5 text-[#0066FF]" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white">Coins</h1>
          <p className="text-xs text-gray-500 mt-0.5">Curate the graduated DEX coins users can discover and trade</p>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="nl-glass rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#0066FF]" />
              <h2 className="text-sm font-semibold text-white">Estimated revenue</h2>
            </div>
            {revenue?.estimated && (
              <span className="text-[10px] text-gray-500">{revenue.basis}</span>
            )}
          </div>
          <RevenueChart series={revenue?.perDay ?? []} />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="nl-glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1 text-gray-400">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-[11px]">Revenue (est.)</span>
            </div>
            <div className="text-xl font-bold text-[#10B981]">{fmtUsd(revenue?.totalRevenueUsd, 2)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="nl-glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1 text-gray-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-[11px]">Volume</span>
              </div>
              <div className="text-base font-bold text-white">{fmtUsd(revenue?.totalVolumeUsd)}</div>
            </div>
            <div className="nl-glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1 text-gray-400">
                <Activity className="w-3.5 h-3.5" />
                <span className="text-[11px]">Trades</span>
              </div>
              <div className="text-base font-bold text-white">{(revenue?.totalTrades ?? 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-chain split */}
      {revenue && revenue.perChain.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {revenue.perChain.map(c => (
            <div key={c.chain} className="nl-glass rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-gray-400">{c.chain}</span>
              <span className="text-xs font-semibold text-[#10B981]">{fmtUsd(c.revenueUsd, 2)}</span>
              <span className="text-[10px] text-gray-600">{c.trades} trades</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? 'bg-[#0066FF]/15 text-[#0066FF]' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ms-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search coins..."
            className="w-full bg-[#0A0E1A]/60 border border-white/[0.08] rounded-xl ps-9 pe-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#0066FF]/50 transition-colors" />
        </div>
      </div>

      {/* Coins table */}
      <div className="nl-glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading coins...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <Coins className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">{query ? 'No coins match your search.' : 'No coins in this view yet.'}</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[820px]">
              <thead className="border-b border-white/10">
                <tr>{['Coin', 'Chain', 'Price', 'Market cap', 'Liquidity', '24h vol', 'Holders', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-start text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const id = `${c.chain}:${c.token_key}`;
                  return (
                    <tr key={id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {c.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.logo_url} alt="" className="w-7 h-7 rounded-full flex-shrink-0 bg-white/5" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-400">
                              {(c.symbol ?? '?').slice(0, 3).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate max-w-[160px]">{c.symbol ?? '—'}</div>
                            <div className="text-[10px] text-gray-500 truncate max-w-[160px]">{c.name ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-[#1E2433] rounded text-[10px] font-mono uppercase text-gray-300">{c.chain}</span></td>
                      <td className="px-4 py-3 text-gray-200 whitespace-nowrap">{fmtPrice(c.price_usd)}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtUsd(c.market_cap_usd)}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtUsd(c.liquidity_usd)}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtUsd(c.volume_24h_usd)}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{c.holders_count != null ? c.holders_count.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.verified && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-[#10B981] bg-[#10B981]/10">Verified</span>}
                          {c.featured && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-[#0066FF] bg-[#0066FF]/10">Featured</span>}
                          {c.hidden && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-rose-400 bg-rose-400/10">Hidden</span>}
                          {!c.verified && !c.featured && !c.hidden && <span className="text-gray-600">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => act(c, c.verified ? 'unverify' : 'verify', 'verified', !c.verified)}
                            disabled={busy === id}
                            aria-label={c.verified ? 'Remove verification' : 'Verify coin'}
                            title={c.verified ? 'Verified' : 'Verify'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${c.verified ? 'text-[#10B981] bg-[#10B981]/10' : 'text-gray-500 hover:text-[#10B981] hover:bg-white/[0.05]'}`}>
                            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => act(c, c.featured ? 'unfeature' : 'feature', 'featured', !c.featured)}
                            disabled={busy === id}
                            aria-label={c.featured ? 'Unfeature coin' : 'Feature coin'}
                            title={c.featured ? 'Featured' : 'Feature'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${c.featured ? 'text-[#0066FF] bg-[#0066FF]/10' : 'text-gray-500 hover:text-[#0066FF] hover:bg-white/[0.05]'}`}>
                            <Star className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => act(c, c.hidden ? 'unhide' : 'hide', 'hidden', !c.hidden)}
                            disabled={busy === id}
                            aria-label={c.hidden ? 'Unhide coin' : 'Hide coin'}
                            title={c.hidden ? 'Hidden' : 'Hide'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${c.hidden ? 'text-rose-400 bg-rose-400/10' : 'text-gray-500 hover:text-rose-400 hover:bg-white/[0.05]'}`}>
                            {c.hidden ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
