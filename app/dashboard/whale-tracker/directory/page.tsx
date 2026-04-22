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
  Filter,
  SlidersHorizontal,
  ChevronRight,
  X,
  Users,
  Crown,
  Building2,
  Coins,
  Bot,
  Code2,
  Loader2,
} from 'lucide-react';
import WhaleDetailDrawer from '@/components/whales/WhaleDetailDrawer';
import FollowWhaleModal from '@/components/whales/FollowWhaleModal';

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
  { id: 'portfolio', label: 'Portfolio Value' },
  { id: 'pnl_30d', label: 'PnL 30d' },
  { id: 'win_rate', label: 'Win Rate' },
  { id: 'recent_activity', label: 'Recently Active' },
];

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

function fmtUsd(v: string | number | null): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n) || n === 0) return '—';
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
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<WhaleRow | null>(null);
  const [followTarget, setFollowTarget] = useState<WhaleRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ limit: '24', offset: String(offset) });
      if (chain) p.set('chain', chain);
      if (entityType) p.set('entity_type', entityType);
      if (q.trim()) p.set('q', q.trim());
      if (minScore > 0) p.set('min_score', String(minScore));
      if (minPortfolio > 0) p.set('min_portfolio_usd', String(minPortfolio));
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
  }, [chain, entityType, q, sort, minScore, minPortfolio, timeframe, performance, offset]);

  useEffect(() => { void load(); }, [load]);

  const aggregatePortfolio = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.portfolio_value_usd) || 0), 0),
    [rows],
  );
  const avgWhaleScore = useMemo(
    () => rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + (r.whale_score || 0), 0) / rows.length),
    [rows],
  );

  return (
    <div className="min-h-screen bg-[#05081E] text-white pb-20">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-[#05081E]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton />
          <div>
            {/* Bug §2.13: header was text-lg with default font; user wanted
                smaller, cleaner. text-sm + tracking-tight + font-sans keeps
                it readable while matching platform typography. */}
            <h1 className="text-sm font-semibold tracking-tight font-sans">Whale Directory</h1>
            <p className="text-[10px] text-slate-500">On-chain whale intelligence</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard/whale-tracker"
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            >
              Live Feed
            </Link>
            {/* Bug §2.12: was full-width "Submit Whale" with gradient — now a
                small, dark neon-blue pill that just says "Submit". */}
            <Link
              href="/dashboard/whale-tracker/submit"
              className="text-[11px] px-2.5 py-1 rounded-md bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold shadow-[0_0_8px_rgba(0,102,255,0.4)]"
            >
              Submit
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto px-4 pb-3 space-y-2">
          {/* Search + sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setOffset(0); }}
                placeholder="Search by label or address…"
                className="flex-1 bg-transparent outline-none text-sm placeholder-slate-500"
              />
              {q && (
                <button onClick={() => setQ('')} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setOffset(0); }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#05081E]">{s.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs">
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

          {/* Chain pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {CHAIN_PILLS.map((c) => {
              const active = chain === c.id;
              const count = c.id ? facets.byChain[c.id] || 0 : Object.values(facets.byChain).reduce((s, v) => s + v, 0);
              return (
                <button
                  key={c.id || 'all'}
                  onClick={() => { setChain(c.id); setOffset(0); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    active ? 'bg-[#0A1EFF]/15 text-[#8FA3FF] border border-[#0A1EFF]/40' : 'bg-white/5 text-slate-400 border border-transparent hover:text-white'
                  }`}
                >
                  {c.label}
                  {count > 0 && <span className="text-slate-500 text-[10px]">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Entity pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {ENTITY_PILLS.map((e) => {
              const active = entityType === e.id;
              const count = e.id ? facets.byEntity[e.id] || 0 : total;
              const Icon = e.Icon;
              return (
                <button
                  key={e.id || 'all'}
                  onClick={() => { setEntityType(e.id); setOffset(0); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${
                    active ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400 border border-transparent hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {e.label}
                  {count > 0 && <span className="text-slate-500 text-[9px]">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* §2.10 advanced filter pill rows */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-[10px]">
            <span className="text-slate-500 uppercase tracking-wider mr-1 shrink-0">Timeframe</span>
            {TIMEFRAME_PILLS.map((t) => {
              const active = timeframe === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTimeframe(t.id); setOffset(0); }}
                  className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    active ? 'bg-[#0A1EFF]/15 text-[#8FA3FF] border border-[#0A1EFF]/40' : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-[10px]">
            <span className="text-slate-500 uppercase tracking-wider mr-1 shrink-0">Performance</span>
            {PERFORMANCE_PILLS.map((p) => {
              const active = performance === p.id;
              return (
                <button
                  key={p.id || 'all'}
                  onClick={() => { setPerformance(p.id); setOffset(0); }}
                  className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    active ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40' : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-[10px]">
            <span className="text-slate-500 uppercase tracking-wider mr-1 shrink-0">Min portfolio</span>
            {VOLUME_PILLS.map((v) => {
              const active = minPortfolio === v.id;
              return (
                <button
                  key={String(v.id)}
                  onClick={() => { setMinPortfolio(v.id); setOffset(0); }}
                  className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    active ? 'bg-purple-500/15 text-purple-300 border border-purple-500/40' : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Aggregate stats strip */}
      <div className="max-w-7xl mx-auto px-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Whales tracked" value={total.toLocaleString()} />
        <StatTile label="Combined portfolio (page)" value={fmtUsd(aggregatePortfolio)} />
        <StatTile label="Avg whale score" value={avgWhaleScore ? `${avgWhaleScore}/100` : '—'} />
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
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading whales…
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0A1EFF] hover:bg-[#0A1EFF]/90 text-white text-xs font-semibold"
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
                onOpen={() => setSelected(w)}
                onFollow={() => setFollowTarget(w)}
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
              className="px-3 py-1.5 rounded-lg bg-white/5 text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">{offset + 1}–{Math.min(offset + 24, total)} of {total}</span>
            <button
              disabled={offset + 24 >= total}
              onClick={() => setOffset(offset + 24)}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selected && (
        <WhaleDetailDrawer
          whale={selected as any}
          onClose={() => setSelected(null)}
          onFollow={() => { setFollowTarget(selected); setSelected(null); }}
        />
      )}
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
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-base font-bold font-mono mt-0.5">{value}</div>
    </div>
  );
}

function WhaleCard({ row, onOpen, onFollow }: { row: WhaleRow; onOpen: () => void; onFollow: () => void }) {
  const c = chainColor(row.chain);
  const score = row.whale_score ?? 0;
  const pnl = Number(row.pnl_30d_usd || 0);
  const pnlPositive = pnl >= 0;

  return (
    <div className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all cursor-pointer" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <WhaleAvatar label={row.label} address={row.address} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-white text-sm truncate">{row.label || short(row.address)}</span>
            {row.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#0A1EFF] shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${c.bg} ${c.fg}`}>{row.chain.toUpperCase()}</span>
            {row.archetype && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{row.archetype}</span>}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">{short(row.address)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Score</div>
          <div className={`text-lg font-black font-mono ${score >= 90 ? 'text-emerald-400' : score >= 75 ? 'text-[#8FA3FF]' : 'text-slate-400'}`}>
            {score}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 mt-3">
        <Metric label="Portfolio" value={fmtUsd(row.portfolio_value_usd)} />
        <Metric
          label="PnL 30d"
          value={fmtUsd(row.pnl_30d_usd)}
          Icon={pnl !== 0 ? (pnlPositive ? TrendingUp : TrendingDown) : undefined}
          tone={pnl > 0 ? 'green' : pnl < 0 ? 'red' : 'neutral'}
        />
        <Metric label="Win rate" value={row.win_rate ? `${Math.round(Number(row.win_rate))}%` : '—'} />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Users className="w-3 h-3" />
          {row.follower_count || 0} followers
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onFollow(); }}
            className="px-2.5 py-1 rounded-lg bg-[#0A1EFF]/15 hover:bg-[#0A1EFF]/25 text-[#8FA3FF] text-[10px] font-semibold"
          >
            Follow
          </button>
          <span className="text-[10px] text-slate-500 group-hover:text-white flex items-center gap-0.5">
            View <ChevronRight className="w-3 h-3" />
          </span>
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
