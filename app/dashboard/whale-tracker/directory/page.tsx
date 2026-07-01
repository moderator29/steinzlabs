'use client';

// Whale Directory — ranked whale entities with rich stats, faceted filters,
// search and sort. Clicking a row opens WhaleDetailDrawer with entity-label
// enrichment, live activity, and follow controls.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/ui/BackButton';
import {
  Search,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  X,
  Users,
  Crown,
  Building2,
  Code2,
  Loader2,
  Star,
  Copy as CopyIcon,
} from 'lucide-react';
import FollowWhaleModal from '@/components/whales/FollowWhaleModal';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { getChainMeta } from '@/lib/chains/chainMeta';
import { ChainLogo } from '@/components/common/ChainLogo';

interface WhaleRow {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  entity_type: string | null;
  archetype: string | null;
  portfolio_value_usd: string | number | null;
  pnl_30d_usd: string | number | null;
  win_rate: string | number | null;
  whale_score: number | null;
  trade_count_30d: number | null;
  volume_7d_usd: string | number | null;
  active_days_7d: number | null;
  follower_count: number | null;
  x_handle: string | null;
  verified: boolean;
  last_active_at: string | null;
}

interface DirectoryResponse {
  whales: WhaleRow[];
  total: number;
  offset: number;
  limit: number;
  facets: { byEntity: Record<string, number>; byChain: Record<string, number> };
}

const CHAIN_PILLS = [
  { id: '', label: 'All chains' },
  { id: 'ethereum', label: 'ETH' },
  { id: 'solana', label: 'SOL' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'ARB' },
  { id: 'optimism', label: 'OP' },
  { id: 'bsc', label: 'BSC' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'avalanche', label: 'AVAX' },
];

const ENTITY_PILLS: Array<{ id: string; label: string; Icon: typeof Users }> = [
  { id: '', label: 'All', Icon: Users },
  { id: 'exchange', label: 'Exchanges', Icon: Building2 },
  { id: 'fund', label: 'Funds', Icon: Crown },
  { id: 'vc', label: 'VCs', Icon: Crown },
  { id: 'institutional', label: 'Institutions', Icon: Building2 },
  { id: 'trader', label: 'Traders', Icon: TrendingUp },
  { id: 'dev', label: 'Devs', Icon: Code2 },
  { id: 'influencer', label: 'Public Figures', Icon: Users },
];

const SORT_OPTIONS = [
  { id: 'score', label: 'Whale Score' },
  { id: 'volume', label: 'DEX Volume 7d' },
  { id: 'portfolio', label: 'Portfolio Value' },
  { id: 'pnl_30d', label: 'PnL 30d' },
  { id: 'win_rate', label: 'Win Rate' },
  { id: 'recent_activity', label: 'Recently Active' },
];

// Activity filter — daily traders (active >=4/7d) are the copy-trade targets;
// "barely active" surfaces dormant wallets. Real-time, server-side.
const ACTIVITY_PILLS = [
  { id: '', label: 'All activity' },
  { id: 'daily', label: 'Daily active' },
  { id: 'barely', label: 'Barely active' },
];

// A genuinely copy-tradeable trader: active most days and NOT a custodial
// exchange/bridge omnibus wallet (you can't mirror an exchange hot wallet).
function isCopyTradeable(row: WhaleRow): boolean {
  const custodial = CUSTODIAL_ENTITIES.has((row.entity_type || '').toLowerCase());
  return !custodial && (row.active_days_7d ?? 0) >= 4;
}

// §2.10 filter pills
const TIMEFRAME_PILLS = [
  { id: '24h', label: '24h' },
  { id: '7d',  label: '7d'  },
  { id: '30d', label: '30d' }, // default — matches how the backfill cron computes metrics
  { id: 'all', label: 'All'  },
];

const PERFORMANCE_PILLS = [
  { id: '',             label: 'All' },
  { id: 'pnl_30d',      label: 'Top Gainers' },      // sort by pnl_30d desc (already default behavior)
  { id: 'pnl_30d_asc',  label: 'Top Losers' },       // server handles _asc suffix
  { id: 'trade_count',  label: 'Most Active' },      // sort by trade_count_30d desc
  { id: 'win_rate',     label: 'Highest Win Rate' }, // sort by win_rate desc
];

const VOLUME_PILLS = [
  { id: 0,       label: 'Any' },
  { id: 10000,   label: '>$10K' },
  { id: 100000,  label: '>$100K' },
  { id: 1000000, label: '>$1M' },
];

// Custodial / non-copy-tradeable entity types where realized PnL / win-rate
// don't apply and copy-trading makes no sense — exchanges, bridges, and
// institutional (CEX cold / market-maker omnibus) wallets.
const CUSTODIAL_ENTITIES = new Set(['exchange', 'cex', 'bridge', 'institutional']);

function fmtUsd(v: string | number | null): string {
  if (v === null || v === undefined) return 'n/a';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n) || n === 0) return 'n/a';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function short(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function chainColor(c: string): { bg: string; fg: string } {
  switch (c) {
    case 'ethereum': return { bg: 'bg-[#627EEA]/10', fg: 'text-[#627EEA]' };
    case 'solana': return { bg: 'bg-[#9945FF]/10', fg: 'text-[#9945FF]' };
    case 'base': return { bg: 'bg-[#0052FF]/10', fg: 'text-[#0052FF]' };
    case 'arbitrum': return { bg: 'bg-[#28A0F0]/10', fg: 'text-[#28A0F0]' };
    case 'optimism': return { bg: 'bg-[#FF0420]/10', fg: 'text-[#FF0420]' };
    case 'bsc': return { bg: 'bg-[#F0B90B]/10', fg: 'text-[#F0B90B]' };
    case 'polygon': return { bg: 'bg-[#8247E5]/10', fg: 'text-[#8247E5]' };
    case 'avalanche': return { bg: 'bg-[#E84142]/10', fg: 'text-[#E84142]' };
    default: return { bg: 'bg-slate-800', fg: 'text-slate-400' };
  }
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return `hsl(${h % 360} 65% 55%)`;
}

function WhaleAvatar({ label, address, size = 40 }: { label: string | null; address: string; size?: number }) {
  const seed = (label || address).slice(0, 2).toUpperCase();
  const bg = avatarColor(label || address);
  return (
    <div
      className="rounded-xl flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size / 2.2 }}
    >
      {seed}
    </div>
  );
}

export default function WhaleDirectoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WhaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{ byEntity: Record<string, number>; byChain: Record<string, number> }>({
    byEntity: {}, byChain: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState('');
  const [entityType, setEntityType] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<string>('score');
  const [minScore, setMinScore] = useState(0);
  const [timeframe, setTimeframe] = useState('30d');
  const [performance, setPerformance] = useState('');
  const [minPortfolio, setMinPortfolio] = useState(0);
  const [activity, setActivity] = useState('');
  const [offset, setOffset] = useState(0);
  const [followTarget, setFollowTarget] = useState<WhaleRow | null>(null);
  const [watched, setWatched] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ limit: '24', offset: String(offset) });
      if (chain) p.set('chain', chain);
      if (entityType) p.set('entity_type', entityType);
      if (q.trim()) p.set('q', q.trim());
      if (minScore > 0) p.set('min_score', String(minScore));
      if (minPortfolio > 0) p.set('min_portfolio_usd', String(minPortfolio));
      if (activity) p.set('activity', activity);
      if (timeframe && timeframe !== '30d') p.set('timeframe', timeframe);
      // Performance pill wins over sort dropdown when set
      const effectiveSort = performance || sort;
      p.set('sort', effectiveSort);
      const res = await fetch(`/api/whales/directory?${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as DirectoryResponse;
      setRows(d.whales || []);
      setTotal(d.total || 0);
      setFacets(d.facets || { byEntity: {}, byChain: {} });
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [chain, entityType, q, sort, minScore, minPortfolio, activity, timeframe, performance, offset]);

  useEffect(() => { void load(); }, [load]);

  // Restore the user's watchlist so the ★ reflects current state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/whale-tracker/watchlist', { signal: AbortSignal.timeout(10_000) });
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as { watchlist?: Array<{ whale_address?: string; chain?: string }> };
        const keys = new Set((d.watchlist ?? []).map((w) => `${(w.chain ?? '').toLowerCase()}:${w.whale_address ?? ''}`).filter(Boolean));
        if (!cancelled) setWatched(keys);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const watchKey = (r: WhaleRow) => `${r.chain.toLowerCase()}:${r.address}`;
  const toggleWatch = useCallback(async (r: WhaleRow) => {
    const key = watchKey(r);
    const isWatched = watched.has(key);
    // Optimistic toggle.
    setWatched((prev) => {
      const next = new Set(prev);
      if (isWatched) next.delete(key); else next.add(key);
      return next;
    });
    try {
      if (isWatched) {
        await fetch(`/api/whale-tracker/watchlist?whale_address=${encodeURIComponent(r.address)}&chain=${encodeURIComponent(r.chain)}`, { method: 'DELETE' });
      } else {
        await fetch('/api/whale-tracker/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whale_address: r.address, chain: r.chain, label: r.label ?? null }),
        });
      }
    } catch {
      // Roll back on failure.
      setWatched((prev) => {
        const next = new Set(prev);
        if (isWatched) next.add(key); else next.delete(key);
        return next;
      });
    }
  }, [watched]);

  const openProfile = useCallback((r: WhaleRow) => {
    router.push(`/dashboard/whale-tracker/${encodeURIComponent(r.address)}?chain=${encodeURIComponent(r.chain)}`);
  }, [router]);

  const startCopy = useCallback((r: WhaleRow) => {
    router.push(`/dashboard/copy-trading?whale=${encodeURIComponent(r.address)}&chain=${encodeURIComponent(r.chain)}&label=${encodeURIComponent(r.label ?? '')}`);
  }, [router]);

  const aggregatePortfolio = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.portfolio_value_usd) || 0), 0),
    [rows],
  );
  const avgWhaleScore = useMemo(
    () => rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + (r.whale_score || 0), 0) / rows.length),
    [rows],
  );

  const chainOptions: SelectOption[] = CHAIN_PILLS.map((c) => ({
    id: c.id,
    label: c.id ? (getChainMeta(c.id)?.label ?? c.label) : 'All chains',
    chain: c.id || undefined,
    count: c.id
      ? facets.byChain[c.id] || 0
      : Object.values(facets.byChain).reduce((s, v) => s + v, 0),
  }));
  const entityOptions: SelectOption[] = ENTITY_PILLS.map((e) => ({
    id: e.id,
    label: e.label,
    Icon: e.Icon,
    count: e.id ? facets.byEntity[e.id] || 0 : total,
  }));
  const timeframeOptions: SelectOption[] = TIMEFRAME_PILLS.map((t) => ({ id: t.id, label: t.label }));
  const performanceOptions: SelectOption[] = PERFORMANCE_PILLS.map((p) => ({ id: p.id, label: p.label }));
  const volumeOptions: SelectOption[] = VOLUME_PILLS.map((v) => ({ id: String(v.id), label: v.label }));

  return (
    <div className="min-h-screen text-white pb-20">
      {/* Top bar */}
      <div className="sticky top-0 z-30 nl-glass backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton compact />
          <div>
            {/* Bug §2.13: header was text-lg with default font; user wanted
                smaller, cleaner. text-sm + tracking-tight + font-sans keeps
                it readable while matching platform typography. */}
            <h1 className="text-sm font-semibold tracking-tight font-sans">Whale Directory</h1>
            <p className="text-[10px] text-slate-500">On-chain whale intelligence</p>
          </div>
          <nav className="ms-auto flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
            <Link href="/dashboard/whale-tracker" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Live Feed</Link>
            <span className="shrink-0 nl-btn-neon !px-3 !py-1.5 !text-[11px] !border-[#0066FF]/90 cursor-default">Directory</span>
            <Link href="/dashboard/whale-tracker/watchlist" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Watchlist</Link>
            <Link href="/dashboard/whale-tracker/copy-trade" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Copy Trade</Link>
            <Link href="/dashboard/whale-tracker/submit" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Submit</Link>
          </nav>
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto px-4 pb-3 space-y-2">
          {/* Search + sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 nl-glass rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setOffset(0); }}
                placeholder="Search by label or address…"
                className="flex-1 bg-transparent outline-none text-sm placeholder-slate-500"
              />
              {q && (
                <button onClick={() => setQ('')} aria-label="Clear search" className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" aria-hidden="true" /></button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setOffset(0); }}
              className="nl-glass rounded-lg px-3 py-2 text-xs outline-none"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#05081E]">{s.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 nl-glass rounded-lg px-3 py-2 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <label className="text-slate-400">Min score</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore || ''}
                onChange={(e) => { setMinScore(parseInt(e.target.value || '0', 10) || 0); setOffset(0); }}
                className="w-12 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* Faceted filters — one compact dropdown each (real chain logos,
              vertical menus) instead of scattered horizontal chip rows. */}
          <div className="flex items-center gap-2 flex-wrap">
            <SelectMenu
              value={chain}
              options={chainOptions}
              onChange={(id) => { setChain(id); setOffset(0); }}
            />
            <SelectMenu
              value={entityType}
              options={entityOptions}
              onChange={(id) => { setEntityType(id); setOffset(0); }}
              accentClass="text-emerald-300"
            />
            <SelectMenu
              value={timeframe}
              options={timeframeOptions}
              onChange={(id) => { setTimeframe(id); setOffset(0); }}
              prefix="Time"
            />
            <SelectMenu
              value={performance}
              options={performanceOptions}
              onChange={(id) => { setPerformance(id); setOffset(0); }}
              prefix="Perf"
              accentClass="text-amber-300"
            />
            <SelectMenu
              value={String(minPortfolio)}
              options={volumeOptions}
              onChange={(id) => { setMinPortfolio(Number(id)); setOffset(0); }}
              prefix="Min"
              accentClass="text-purple-300"
            />
          </div>

          {/* Activity filter — daily-active traders are the copy-trade targets. */}
          <div className="flex items-center gap-2 flex-wrap">
            {ACTIVITY_PILLS.map((a) => (
              <button
                key={a.id || 'all'}
                onClick={() => { setActivity(a.id); setOffset(0); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  activity === a.id
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aggregate stats strip */}
      <div className="max-w-7xl mx-auto px-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Whales tracked" value={total.toLocaleString()} />
        <StatTile label="Combined portfolio (page)" value={fmtUsd(aggregatePortfolio)} />
        <StatTile label="Avg whale score" value={avgWhaleScore ? `${avgWhaleScore}/100` : 'n/a'} />
        <StatTile label="Chains covered" value={String(Object.keys(facets.byChain).length)} />
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin me-2" /> Loading whales…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-300 font-semibold mb-1">No whales match those filters.</p>
            {/* §2.11 — if the search looks like an address (starts with 0x
                or plausible base58 Solana) and produced zero results, offer
                the Submit CTA directly instead of just "clear filters". */}
            {(q.trim().startsWith('0x') && q.trim().length === 42) || (q.trim().length >= 32 && !q.trim().includes(' ')) ? (
              <div className="mt-2">
                <p className="text-slate-500 text-sm mb-3">No whale matches <code className="px-1 py-0.5 rounded bg-slate-900 text-[11px] font-mono">{q.slice(0, 10)}…</code> in our directory.</p>
                <a
                  href={`/dashboard/whale-tracker/submit?address=${encodeURIComponent(q.trim())}`}
                  className="nl-btn-neon !px-4 !py-2 !text-xs"
                >
                  Submit this whale
                </a>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Clear filters or search by address to discover more.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((w) => (
              <WhaleCard
                key={w.id}
                row={w}
                watched={watched.has(watchKey(w))}
                onOpen={() => openProfile(w)}
                onFollow={() => setFollowTarget(w)}
                onToggleWatch={() => toggleWatch(w)}
                onCopy={() => startCopy(w)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > rows.length && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 24))}
              className="nl-btn-neon !px-3 !py-1.5 !text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">{offset + 1} to {Math.min(offset + 24, total)} of {total}</span>
            <button
              disabled={offset + 24 >= total}
              onClick={() => setOffset(offset + 24)}
              className="nl-btn-neon !px-3 !py-1.5 !text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {followTarget && (
        <FollowWhaleModal
          whale={followTarget as any}
          onClose={() => setFollowTarget(null)}
          onDone={() => setFollowTarget(null)}
        />
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="nl-glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-base font-bold font-mono mt-0.5">{value}</div>
    </div>
  );
}

function WhaleCard({ row, watched, onOpen, onFollow, onToggleWatch, onCopy }: {
  row: WhaleRow;
  watched: boolean;
  onOpen: () => void;
  onFollow: () => void;
  onToggleWatch: () => void;
  onCopy: () => void;
}) {
  const c = chainColor(row.chain);
  const score = row.whale_score ?? 0;
  const pnl = Number(row.pnl_30d_usd || 0);
  const pnlPositive = pnl >= 0;
  const custodial = CUSTODIAL_ENTITIES.has((row.entity_type || '').toLowerCase());
  const copyable = isCopyTradeable(row);

  return (
    <div className="group nl-glass nl-glass--interactive rounded-xl p-5 cursor-pointer" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <WhaleAvatar label={row.label} address={row.address} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-white text-sm truncate">{row.label || short(row.address)}</span>
            {row.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${c.bg} ${c.fg}`}><ChainLogo chain={row.chain} size={11} />{row.chain.toUpperCase()}</span>
            {(row.active_days_7d ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">{row.active_days_7d}/7d</span>
            )}
            {row.archetype && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 truncate max-w-[120px]">{row.archetype}</span>}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">{short(row.address)}</div>
        </div>
        <div className="flex items-start gap-1.5 shrink-0 ps-2">
          {/* Watchlist ★ — top-right of the card, always available. */}
          <button
            type="button"
            aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            onClick={(e) => { e.stopPropagation(); onToggleWatch(); }}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-md border transition-colors ${
              watched
                ? 'bg-[#0066FF]/15 border-[#0066FF]/45 text-[#8FA3FF]'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-[#8FA3FF] hover:border-[#0066FF]/30'
            }`}
          >
            <Star className="w-3.5 h-3.5" fill={watched ? 'currentColor' : 'none'} />
          </button>
          <div className="text-end">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Score</div>
            <div className={`text-lg font-black font-mono leading-tight ${score >= 90 ? 'text-emerald-400' : score >= 75 ? 'text-[#8FA3FF]' : 'text-slate-400'}`}>
              {score}
            </div>
          </div>
        </div>
      </div>

      {custodial ? (
        // Exchange / bridge / CEX wallets are custodial flow accounts — realized
        // PnL and win-rate are meaningless for them, so show holdings + an honest
        // note instead of a row of "n/a".
        <div className="mt-4">
          <Metric label="Holdings" value={fmtUsd(row.portfolio_value_usd)} />
          <p className="text-[9px] text-slate-500 mt-1.5">Custodial wallet · PnL and win rate not applicable</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Metric label="Vol 7d" value={fmtUsd(row.volume_7d_usd)} tone={row.volume_7d_usd ? 'green' : 'neutral'} />
          <Metric
            label="PnL 30d"
            value={fmtUsd(row.pnl_30d_usd)}
            Icon={pnl !== 0 ? (pnlPositive ? TrendingUp : TrendingDown) : undefined}
            tone={pnl > 0 ? 'green' : pnl < 0 ? 'red' : 'neutral'}
          />
          <Metric label="Win rate" value={row.win_rate ? `${Math.round(Number(row.win_rate))}%` : 'n/a'} />
        </div>
      )}

      {/* Footer — followers chip on the left; actions on the right. Fixed heights
          + shrink-0 so nothing overlaps even on narrow cards. The copy-trade
          icon only appears for genuinely active, non-custodial traders. */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
        <div className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-slate-400 min-w-0">
          <Users className="w-3 h-3 shrink-0" />
          <span className="truncate tabular-nums">{(row.follower_count || 0).toLocaleString()}</span>
        </div>
        <div className="ms-auto flex items-center gap-1.5 shrink-0">
          {copyable && (
            <button
              type="button"
              aria-label="Copy trade this whale"
              onClick={(e) => { e.stopPropagation(); onCopy(); }}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md nl-glass border border-[#0066FF]/45 text-[#8FA3FF] hover:text-white hover:border-[#0066FF]/70 transition-colors"
              title="Copy trade"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onFollow(); }}
            className="inline-flex items-center justify-center h-7 px-3 rounded-md bg-[#0066FF]/15 hover:bg-[#0066FF]/25 border border-[#0066FF]/35 text-[#8FA3FF] text-[11px] font-semibold transition-colors"
          >
            Follow
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="inline-flex items-center justify-center gap-0.5 h-7 px-2.5 rounded-md nl-glass border border-[#0066FF]/30 text-[11px] text-[#8FA3FF] hover:text-white hover:border-[#0066FF]/60 transition-colors"
          >
            View <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  Icon?: typeof TrendingUp;
  tone?: 'green' | 'red' | 'neutral';
}) {
  const color =
    tone === 'green' ? 'text-emerald-400' :
    tone === 'red' ? 'text-red-400' :
    'text-white';
  return (
    <div className="bg-black/20 rounded-lg p-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-[11px] font-bold font-mono mt-0.5 flex items-center gap-1 ${color}`}>
        {Icon && <Icon className="w-3 h-3" />}
        {value}
      </div>
    </div>
  );
}
