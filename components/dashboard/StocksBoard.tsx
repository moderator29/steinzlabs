'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickChart, Star, Search, TrendingUp, TrendingDown, X } from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';
import { StockDetailSheet } from '@/components/stocks/StockDetailSheet';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * StocksBoard — the home Stocks surface, rebuilt Apple-Stocks style on real
 * Yahoo Finance data (keyless): a top scrolling ticker strip, tabs (Stocks /
 * RWA / AI stocks / Watchlist), rows with a mini sparkline + real change pill,
 * and a tap-to-open detail sheet with a timeframe chart, key stats and in-app
 * Yahoo news. Real data only; honest empty states when the feed is unreachable.
 */

const UP = '#10B981';
const DOWN = '#F43F5E';

interface Row { symbol: string; name: string; price: number; change: number | null; changePct: number | null; spark: number[]; currency: string; }
type Tab = 'stocks' | 'rwa' | 'ai' | 'watchlist';
const TABS: Array<{ key: Tab; label: string; apiTab?: 'stocks' | 'rwa' | 'ai' }> = [
  { key: 'stocks', label: 'Stocks', apiTab: 'stocks' },
  { key: 'rwa', label: 'RWA', apiTab: 'rwa' },
  { key: 'ai', label: 'AI stocks', apiTab: 'ai' },
  { key: 'watchlist', label: 'Watchlist' },
];

function fmtPrice(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return '–';
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtChange(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
}

// US equity market status (NYSE/Nasdaq regular hours, 9:30–16:00 ET, Mon–Fri).
// Computed client-side from the browser clock converted to ET — no data needed.
function marketStatus(): { open: boolean; label: string } {
  try {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay(); // 0 Sun .. 6 Sat
    const mins = et.getHours() * 60 + et.getMinutes();
    const open = day >= 1 && day <= 5 && mins >= 570 && mins < 960;
    return { open, label: open ? 'Market open' : 'Market closed' };
  } catch {
    return { open: false, label: 'Market closed' };
  }
}

// Biggest gainers + losers from the loaded rows (real change % only).
function pickMovers(rows: Row[]): Row[] {
  const withChange = rows.filter((r) => r.changePct != null && Number.isFinite(r.changePct) && r.changePct !== 0);
  if (withChange.length < 2) return [];
  const sorted = [...withChange].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const gainers = sorted.filter((r) => (r.changePct ?? 0) > 0).slice(0, 3);
  const losers = sorted.filter((r) => (r.changePct ?? 0) < 0).slice(-3).reverse();
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of [...gainers, ...losers]) { if (!seen.has(r.symbol)) { seen.add(r.symbol); out.push(r); } }
  return out;
}

// ─── On-device watchlist (per signed-in user) ────────────────────────────────
function wlKey(uid: string | null) { return uid ? `nl-stocks-watchlist:${uid}` : null; }
function readWl(uid: string | null): string[] {
  const k = wlKey(uid);
  if (!k || typeof window === 'undefined') return [];
  try { const r = window.localStorage.getItem(k); const p = r ? JSON.parse(r) : []; return Array.isArray(p) ? p.filter((s) => typeof s === 'string') : []; } catch { return []; }
}
function writeWl(uid: string | null, syms: string[]) {
  const k = wlKey(uid); if (!k || typeof window === 'undefined') return;
  try { window.localStorage.setItem(k, JSON.stringify(syms)); } catch { /* ignore */ }
}

function StockRowItem({ row, starred, canStar, onStar, onOpen }: { row: Row; starred: boolean; canStar: boolean; onStar: () => void; onOpen: () => void; }) {
  const up = (row.changePct ?? 0) >= 0;
  const hasChange = row.changePct != null && Number.isFinite(row.changePct);
  const hasSpark = row.spark.filter((n) => Number.isFinite(n)).length >= 2;
  return (
    <div className="flex items-center gap-1 border-b border-white/[0.05] last:border-b-0">
      {canStar && (
        <button type="button" onClick={onStar} aria-pressed={starred} className="shrink-0 p-2 -ml-1 rounded-lg hover:bg-white/[0.05]" aria-label={starred ? 'Unstar' : 'Star'}>
          <Star className="w-4 h-4" style={{ color: starred ? '#F5B841' : 'rgba(255,255,255,0.3)', fill: starred ? '#F5B841' : 'none' }} />
        </button>
      )}
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 py-3 px-1 text-left hover:bg-white/[0.03] rounded-lg">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-white truncate">{row.symbol.replace(/^\^/, '')}</div>
          <div className="text-xs text-white/45 truncate">{row.name}</div>
        </div>
        {hasSpark && (
          <div className="shrink-0 hidden min-[400px]:block">
            <Sparkline data={row.spark} width={72} height={28} stroke={hasChange ? (up ? UP : DOWN) : 'rgba(255,255,255,0.35)'} filled />
          </div>
        )}
        <div className="flex flex-col items-end shrink-0 min-w-[92px] gap-1">
          <div className="text-[15px] font-semibold text-white tabular-nums">{fmtPrice(row.price)}</div>
          {hasChange ? (
            <div className="rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-white min-w-[64px] text-center" style={{ backgroundColor: up ? UP : DOWN }}>
              {fmtChange(row.change)}
            </div>
          ) : <div className="text-[11px] text-white/35">Spot price</div>}
        </div>
      </button>
    </div>
  );
}

export default function StocksBoard() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [tab, setTab] = useState<Tab>('stocks');
  const [showAll, setShowAll] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [ticker, setTicker] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [openSymbol, setOpenSymbol] = useState<{ symbol: string; name: string } | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(marketStatus());
  const rowCache = useRef<Map<string, Row>>(new Map());

  // Refresh the market open/closed indicator every minute.
  useEffect(() => { const id = setInterval(() => setStatus(marketStatus()), 60_000); return () => clearInterval(id); }, []);

  const submitSearch = useCallback(() => {
    const s = query.trim().toUpperCase();
    if (!s) return;
    setOpenSymbol({ symbol: s, name: s });
    setQuery('');
  }, [query]);

  useEffect(() => { setWatchlist(readWl(uid)); }, [uid]);
  const starred = useMemo(() => new Set(watchlist), [watchlist]);
  const canStar = !!uid;
  const toggleStar = useCallback((sym: string) => {
    setWatchlist((cur) => { const next = cur.includes(sym) ? cur.filter((s) => s !== sym) : [...cur, sym]; writeWl(uid, next); return next; });
  }, [uid]);

  const apiTab = TABS.find((t) => t.key === tab)?.apiTab ?? 'stocks';
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Watchlist reuses the stocks feed (all) so starred rows resolve.
      const t = tab === 'watchlist' ? 'stocks' : apiTab;
      const all = tab === 'watchlist' ? true : showAll;
      const res = await fetch(`/api/markets/stocks?tab=${t}&all=${all ? 1 : 0}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('stocks');
      const j = await res.json();
      const list: Row[] = Array.isArray(j.rows) ? j.rows : [];
      for (const r of list) rowCache.current.set(r.symbol, r);
      for (const r of (j.ticker ?? [])) rowCache.current.set(r.symbol, r);
      setRows(list);
      if (Array.isArray(j.ticker) && j.ticker.length) setTicker(j.ticker);
      setErrored(!j.available && tab !== 'watchlist');
    } catch { setErrored(true); }
    finally { setLoading(false); }
  }, [tab, apiTab, showAll]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const visibleRows = useMemo(() => {
    if (tab === 'watchlist') return watchlist.map((s) => rowCache.current.get(s)).filter(Boolean) as Row[];
    return rows;
  }, [tab, rows, watchlist]);

  const movers = useMemo(() => pickMovers(rows), [rows]);

  return (
    <div className="space-y-4">
      {/* Injected marquee keyframes (scoped, one-time). */}
      <style>{`@keyframes nl-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>

      {/* Top scrolling ticker strip (breaking-news style) */}
      {ticker.length > 0 && (
        <div className="nl-glass rounded-2xl overflow-hidden py-2">
          <div className="relative overflow-hidden">
            <div className="flex gap-6 w-max" style={{ animation: 'nl-ticker 40s linear infinite' }}>
              {[...ticker, ...ticker].map((r, i) => {
                const up = (r.changePct ?? 0) >= 0;
                return (
                  <button key={`${r.symbol}-${i}`} onClick={() => setOpenSymbol({ symbol: r.symbol, name: r.name })} className="flex items-center gap-2 shrink-0 px-1">
                    <span className="text-[13px] font-bold text-white">{r.symbol.replace(/^\^/, '')}</span>
                    {r.spark.length >= 2 && <Sparkline data={r.spark} width={44} height={18} stroke={up ? UP : DOWN} />}
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: up ? UP : DOWN }}>{fmtChange(r.change)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Intro + market status + search */}
      <div className="nl-glass rounded-2xl px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#0066FF]/[0.10] shrink-0"><CandlestickChart className="w-4 h-4 text-[#4D6BFF]" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">Stocks &amp; Real-World Assets</h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.open ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/25' : 'bg-white/[0.05] text-white/50 ring-1 ring-inset ring-white/10'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.open ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />{status.label}
              </span>
            </div>
            <p className="text-xs text-[#B4C0E0] mt-0.5">Live equities, RWA and AI names with real charts and news from Yahoo Finance.</p>
          </div>
        </div>
        {/* Search any ticker */}
        <div className="mt-3 flex items-center gap-2 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 focus-within:border-[#0066FF]/40 transition-colors">
          <Search className="w-4 h-4 text-white/40 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
            placeholder="Search any ticker (AAPL, NVDA, TSLA…)"
            className="flex-1 min-w-0 bg-transparent appearance-none border-0 outline-none text-base sm:text-sm text-white placeholder:text-white/35"
          />
          {query ? (
            <button onClick={() => setQuery('')} aria-label="Clear" className="text-white/40 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
          ) : null}
        </div>
      </div>

      <div className="nl-glass rounded-2xl p-4 sm:p-5">
        {/* Tabs */}
        <div className="mb-3 -mx-1 px-1 overflow-x-auto no-scrollbar">
          <div className="inline-flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 min-w-full">
            {TABS.map((t) => {
              const active = t.key === tab;
              const count = t.key === 'watchlist' && watchlist.length ? watchlist.length : null;
              return (
                <button key={t.key} onClick={() => { setTab(t.key); }} aria-pressed={active}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? 'bg-[#0066FF] text-white shadow-sm' : 'text-white/55 hover:text-white/80'}`}>
                  {t.label}{count != null && <span className={`ml-1 tabular-nums ${active ? 'text-white/80' : 'text-white/40'}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top movers (real change % only; hidden on watchlist / when thin) */}
        {tab !== 'watchlist' && movers.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#4D6BFF]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Top movers</span>
            </div>
            <div className="-mx-1 px-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-2 min-w-min">
                {movers.map((r) => {
                  const up = (r.changePct ?? 0) >= 0;
                  return (
                    <button key={r.symbol} onClick={() => setOpenSymbol({ symbol: r.symbol, name: r.name })}
                      className="shrink-0 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-left hover:bg-white/[0.07] transition-colors">
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-white leading-tight truncate max-w-[90px]">{r.symbol.replace(/^\^/, '')}</div>
                        <div className="text-[13px] font-semibold tabular-nums leading-tight" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{(r.changePct ?? 0).toFixed(2)}%</div>
                      </div>
                      {up ? <TrendingUp className="w-4 h-4 shrink-0" style={{ color: UP }} /> : <TrendingDown className="w-4 h-4 shrink-0" style={{ color: DOWN }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="max-h-[70vh] overflow-y-auto no-scrollbar -mx-1 px-1">
          {loading && rows.length === 0 && (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="flex-1 space-y-2"><div className="h-4 w-16 rounded bg-white/10 animate-pulse" /><div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" /></div>
                  <div className="h-6 w-20 rounded bg-white/[0.06] animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!loading && errored && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <div className="text-[15px] font-semibold text-white">Live market data coming online</div>
              <div className="text-xs text-white/45 mt-1 max-w-xs">Real-time equities and RWA appear here once the feed connects.</div>
            </div>
          )}

          {!loading && !errored && visibleRows.length === 0 && tab === 'watchlist' && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <Star className="w-6 h-6 text-white/25 mb-3" />
              <div className="text-[15px] font-semibold text-white">{canStar ? 'Your watchlist is empty' : 'Sign in to build a watchlist'}</div>
              <div className="text-xs text-white/45 mt-1 max-w-xs">Tap the star on any ticker to pin it here.</div>
            </div>
          )}

          {visibleRows.length > 0 && (
            <div>
              {visibleRows.map((r) => (
                <StockRowItem key={`${apiTab}-${r.symbol}`} row={r} starred={starred.has(r.symbol)} canStar={canStar} onStar={() => toggleStar(r.symbol)} onOpen={() => setOpenSymbol({ symbol: r.symbol, name: r.name })} />
              ))}
            </div>
          )}

          {/* Show all / Show less */}
          {!loading && !errored && tab !== 'watchlist' && (
            <button onClick={() => setShowAll((v) => !v)} className="w-full mt-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm font-semibold text-[#8fb6ff] hover:bg-white/[0.07] transition-colors">
              {showAll ? 'Show less' : 'Show all'}
            </button>
          )}
        </div>
      </div>

      {openSymbol && (
        <StockDetailSheet
          symbol={openSymbol.symbol}
          name={openSymbol.name}
          uid={uid}
          starred={starred.has(openSymbol.symbol)}
          onToggleStar={canStar ? () => toggleStar(openSymbol.symbol) : undefined}
          onClose={() => setOpenSymbol(null)}
        />
      )}
    </div>
  );
}
