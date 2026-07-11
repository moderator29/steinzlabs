'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CandlestickChart, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * StocksBoard: the home **Stocks** sub-tab surface.
 *
 * Real equity + tokenized real-world-asset prices from /api/markets/rwa. Adds
 * an in-board segmented control (Stocks / RWA / AI stocks / Watchlist), a top
 * movers strip, a tap-to-expand price chart and an on-device watchlist.
 *
 * Real data only. Twelve Data supplies quotes, daily change and a 30 point
 * series. The keyless Pyth fallback supplies a real spot price but no daily
 * change and no series, so those rows honestly omit the change chip, hide the
 * movers strip and show an honest empty state in place of a chart. Nothing is
 * fabricated.
 *
 * Watchlist: equities do not map cleanly onto the crypto `watchlist` table
 * (keyed by token_id and reused by the crypto market list), so stars persist as
 * a clearly labeled on-device preference, scoped per signed-in user. No server
 * persistence is faked.
 */

// ─── API contract (mirrors /api/markets/rwa) ─────────────────────────────────

type Section = 'indices' | 'stocks' | 'commodities';

interface RwaRow {
  section: Section;
  symbol: string;
  name: string;
  price: number;
  changeAbs: number | null;
  changePct: number | null;
  spark: number[];
  asOf: string | null;
  feed?: string | null;
}

type ApiResponse =
  | { available: true; source: 'twelvedata' | 'pyth'; asOf: string; rows: RwaRow[] }
  | { available: false; reason: string };

// Lazily-loaded daily series for a single ticker (fetched on expand from
// /api/markets/rwa/history — real Pyth benchmark candles, keyless).
type LazyHistory =
  | { state: 'loading' }
  | { state: 'ready'; closes: number[]; changeAbs: number | null; changePct: number | null }
  | { state: 'none' };

interface HistoryResponse {
  available: boolean;
  closes?: number[];
  changeAbs?: number | null;
  changePct?: number | null;
}

const UP = '#10B981';
const DOWN = '#EF4444';

// ─── Board sub-tabs ──────────────────────────────────────────────────────────
// AI stocks are the AI-exposed names the owner called out. Only tickers the
// feed can actually price ever appear, so the intersection with the live
// universe is what shows (never a padded or invented row).

type TabKey = 'stocks' | 'rwa' | 'ai' | 'watchlist';

// The AI-exposed basket — semis, hyperscalers and AI-native names. Only the
// ones the live feed actually prices ever render (intersection with the
// universe), so this never pads the tab with unpriced rows.
const AI_SYMBOLS = new Set([
  'NVDA', 'MSFT', 'GOOGL', 'GOOG', 'AMD', 'AVGO', 'TSM', 'SMCI', 'AMZN', 'META',
  'PLTR', 'ARM', 'MU', 'INTC', 'ASML', 'ORCL', 'CRM', 'ADBE', 'NOW', 'SNOW',
  'AI', 'DELL', 'ANET', 'MRVL', 'QCOM', 'IBM', 'CRWD', 'PANW', 'TSLA', 'APP',
]);

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'stocks', label: 'Stocks' },
  { key: 'rwa', label: 'RWA' },
  { key: 'ai', label: 'AI stocks' },
  { key: 'watchlist', label: 'Watchlist' },
];

function matchesSectionTab(row: RwaRow, tab: TabKey): boolean {
  switch (tab) {
    case 'stocks':
      return row.section === 'indices' || row.section === 'stocks';
    case 'rwa':
      return row.section === 'commodities';
    case 'ai':
      return AI_SYMBOLS.has(row.symbol);
    case 'watchlist':
      return true; // filtered by the starred set, not by section
  }
}

// ─── On-device watchlist (per signed-in user) ────────────────────────────────

function watchlistKey(userId: string | null): string | null {
  return userId ? `nl-stocks-watchlist:${userId}` : null;
}

function readWatchlist(userId: string | null): string[] {
  const key = watchlistKey(userId);
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeWatchlist(userId: string | null, symbols: string[]): void {
  const key = watchlistKey(userId);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(symbols));
  } catch {
    // Storage full or unavailable: the star simply does not persist. No fake state.
  }
}

// ─── Formatting (every number guarded before toFixed) ────────────────────────

function fmtPrice(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return '-';
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChangePct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function fmtChangeAbs(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Top movers strip (real 24h change only) ─────────────────────────────────
// Biggest gainers and losers by real percent change. Rows with no change data
// (the keyless Pyth fallback) are excluded, and the strip hides entirely rather
// than show zeros.

function pickMovers(rows: RwaRow[]): RwaRow[] {
  const withChange = rows.filter(
    (r) => r.changePct != null && Number.isFinite(r.changePct) && r.changePct !== 0,
  );
  if (withChange.length < 2) return [];
  const sorted = [...withChange].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const gainers = sorted.filter((r) => (r.changePct ?? 0) > 0).slice(0, 2);
  const losers = sorted
    .filter((r) => (r.changePct ?? 0) < 0)
    .slice(-2)
    .reverse();
  // Preserve gainer-first ordering, dedupe by symbol.
  const seen = new Set<string>();
  const out: RwaRow[] = [];
  for (const r of [...gainers, ...losers]) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    out.push(r);
  }
  return out;
}

function MoversStrip({ rows, onPick }: { rows: RwaRow[]; onPick: (symbol: string) => void }) {
  const movers = useMemo(() => pickMovers(rows), [rows]);
  if (movers.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
        <TrendingUp className="w-3.5 h-3.5 text-[#4D6BFF]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
          Top movers
        </span>
      </div>
      <div className="-mx-1 px-1 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-min">
          {movers.map((r) => {
            const up = (r.changePct ?? 0) >= 0;
            return (
              <button
                key={r.symbol}
                type="button"
                onClick={() => onPick(r.symbol)}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white leading-tight truncate max-w-[92px]">
                    {r.symbol}
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums leading-tight" style={{ color: up ? UP : DOWN }}>
                    {fmtChangePct(r.changePct)}
                  </div>
                </div>
                {up ? (
                  <TrendingUp className="w-4 h-4 shrink-0" style={{ color: UP }} />
                ) : (
                  <TrendingDown className="w-4 h-4 shrink-0" style={{ color: DOWN }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Expanded price chart (responsive, drawn from the real series) ───────────

function PriceChart({ data, up }: { data: number[]; up: boolean }) {
  // viewBox space; preserveAspectRatio="none" lets it stretch full width while a
  // non-scaling stroke keeps the line crisp.
  const W = 100;
  const H = 40;
  const finite = data.filter((n) => Number.isFinite(n));
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const stepX = W / (finite.length - 1);
  const pts = finite.map((v, i) => {
    const x = i * stepX;
    const y = H - ((v - min) / span) * H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const color = up ? UP : DOWN;
  const area = `0,${H} ${pts.join(' ')} ${W},${H}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-28"
      aria-label="Price trend"
      role="img"
    >
      <polygon points={area} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Row + expandable detail ─────────────────────────────────────────────────

function Row({
  row,
  open,
  onToggle,
  starred,
  canStar,
  onToggleStar,
  lazy,
}: {
  row: RwaRow;
  open: boolean;
  onToggle: () => void;
  starred: boolean;
  canStar: boolean;
  onToggleStar: () => void;
  lazy?: LazyHistory;
}) {
  // The list row may carry no series (keyless spot rows). On expand the board
  // fetches a real daily series and passes it in as `lazy`; prefer that.
  const lazyCloses = lazy && lazy.state === 'ready' ? lazy.closes : [];
  const series = row.spark.filter((n) => Number.isFinite(n)).length >= 2 ? row.spark : lazyCloses;
  // Change: the row's own (Twelve Data) change wins; otherwise the lazy series' change.
  const changePct = row.changePct != null && Number.isFinite(row.changePct)
    ? row.changePct
    : (lazy && lazy.state === 'ready' ? lazy.changePct : null);
  const changeAbs = row.changeAbs != null && Number.isFinite(row.changeAbs)
    ? row.changeAbs
    : (lazy && lazy.state === 'ready' ? lazy.changeAbs : null);
  const hasChange = changePct != null && Number.isFinite(changePct);
  const up = (changePct ?? 0) >= 0;
  const hasSeries = series.filter((n) => Number.isFinite(n)).length >= 2;
  const seriesLen = series.filter((n) => Number.isFinite(n)).length;
  const lazyLoading = lazy?.state === 'loading';

  return (
    <div className="border-b border-white/[0.05] last:border-b-0">
      <div className="flex items-center gap-1">
        {canStar && (
          <button
            type="button"
            onClick={onToggleStar}
            aria-pressed={starred}
            aria-label={starred ? `Remove ${row.symbol} from watchlist` : `Add ${row.symbol} to watchlist`}
            className="shrink-0 p-2 -ml-1 rounded-lg transition-colors hover:bg-white/[0.05]"
          >
            <Star
              className="w-4 h-4"
              style={{
                color: starred ? '#F5B841' : 'rgba(255,255,255,0.30)',
                fill: starred ? '#F5B841' : 'none',
              }}
            />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-3 py-3 px-1 text-left transition-colors hover:bg-white/[0.03] rounded-lg"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-white truncate">{row.symbol}</div>
            <div className="text-xs text-white/45 truncate">{row.name}</div>
          </div>

          {hasSeries && (
            <div className="shrink-0 hidden sm:block">
              <Sparkline data={series} width={64} height={24} stroke={up ? UP : DOWN} />
            </div>
          )}

          <div className="flex flex-col items-end shrink-0 min-w-[84px]">
            <div className="text-[15px] font-semibold text-white tabular-nums">{fmtPrice(row.price)}</div>
            {hasChange ? (
              <div
                className="mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white"
                style={{ backgroundColor: up ? UP : DOWN }}
              >
                {fmtChangePct(changePct)}
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] text-white/35">Spot price</div>
            )}
          </div>
        </button>
      </div>

      {open && (
        <div className="px-1 pb-4 pt-1">
          {hasSeries ? (
            <>
              <PriceChart data={series} up={up} />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-white/45">Last {seriesLen} sessions</span>
                {hasChange && (
                  <span className="font-semibold tabular-nums" style={{ color: up ? UP : DOWN }}>
                    {fmtChangeAbs(changeAbs)} ({fmtChangePct(changePct)})
                  </span>
                )}
              </div>
            </>
          ) : lazyLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/45">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
              Loading chart…
            </div>
          ) : (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-6 text-center">
              <div className="text-[13px] font-semibold text-white/80">Chart unavailable</div>
              <div className="text-xs text-white/45 mt-1">
                No daily series is published for this ticker right now.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-white/[0.05] last:border-b-0">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-16 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
      </div>
      <div className="flex flex-col items-end space-y-2 min-w-[84px]">
        <div className="h-4 w-20 rounded bg-white/10 animate-pulse" />
        <div className="h-4 w-14 rounded bg-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────

export default function StocksBoard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [tab, setTab] = useState<TabKey>('stocks');
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  // Per-symbol lazily-loaded chart series (keyed by display symbol).
  const [history, setHistory] = useState<Record<string, LazyHistory>>({});

  // Hydrate the on-device watchlist once the signed-in user is known.
  useEffect(() => {
    setWatchlist(readWatchlist(userId));
  }, [userId]);

  const starred = useMemo(() => new Set(watchlist), [watchlist]);

  const toggleStar = useCallback(
    (symbol: string) => {
      setWatchlist((cur) => {
        const next = cur.includes(symbol) ? cur.filter((s) => s !== symbol) : [...cur, symbol];
        writeWatchlist(userId, next);
        return next;
      });
    },
    [userId],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/markets/rwa', { cache: 'no-store' });
      if (!res.ok) throw new Error(`markets ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setErrored(false);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  // On expand, lazily pull a real daily series for the opened ticker so every
  // row (not just the Twelve Data core) gets a chart. Rows that already carry a
  // series, or have no Pyth feed to chart, are skipped.
  useEffect(() => {
    if (!openSymbol) return;
    const allRows = data && data.available ? data.rows : [];
    const row = allRows.find((r) => r.symbol === openSymbol);
    if (!row || !row.feed) return;
    if (row.spark.filter((n) => Number.isFinite(n)).length >= 2) return; // already has a series
    if (history[openSymbol]) return; // already fetched / fetching

    let cancelled = false;
    setHistory((h) => ({ ...h, [openSymbol]: { state: 'loading' } }));
    fetch(`/api/markets/rwa/history?feed=${encodeURIComponent(row.feed)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<HistoryResponse>) : null))
      .then((j) => {
        if (cancelled) return;
        if (j && j.available && Array.isArray(j.closes) && j.closes.length >= 2) {
          setHistory((h) => ({
            ...h,
            [openSymbol]: {
              state: 'ready',
              closes: j.closes as number[],
              changeAbs: j.changeAbs ?? null,
              changePct: j.changePct ?? null,
            },
          }));
        } else {
          setHistory((h) => ({ ...h, [openSymbol]: { state: 'none' } }));
        }
      })
      .catch(() => {
        if (!cancelled) setHistory((h) => ({ ...h, [openSymbol]: { state: 'none' } }));
      });

    return () => {
      cancelled = true;
    };
  }, [openSymbol, data, history]);

  const asOf = data && data.available ? fmtDate(data.asOf) : '';
  const sourceLabel =
    data && data.available ? (data.source === 'pyth' ? 'Pyth' : 'Twelve Data') : null;

  const allRows = data && data.available ? data.rows : [];

  const rows = useMemo(() => {
    if (tab === 'watchlist') return allRows.filter((r) => starred.has(r.symbol));
    return allRows.filter((r) => matchesSectionTab(r, tab));
  }, [allRows, tab, starred]);

  const unavailable = (!loading && errored) || (data != null && !data.available);
  const canStar = !!userId;

  return (
    <div className="space-y-4">
      {/* Section intro: flat lucide icon, glass, brand blue. */}
      <div className="nl-glass rounded-2xl px-4 py-3.5 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#0066FF]/[0.10] shrink-0">
          <CandlestickChart className="w-4 h-4 text-[#4D6BFF]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Stocks &amp; Real-World Assets</h3>
          <p className="text-xs text-[#B4C0E0] mt-0.5">
            Live equities and tokenized RWA prices, kept separate from the crypto Market view.
          </p>
        </div>
      </div>

      {/* Board */}
      <div className="nl-glass rounded-2xl p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-3 gap-2">
          <h2 className="text-xl font-bold text-white">Markets</h2>
          <div className="flex items-center gap-2 shrink-0">
            {sourceLabel && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {sourceLabel}
              </span>
            )}
            {asOf && <span className="text-xs text-white/45">{asOf}</span>}
          </div>
        </div>

        {/* Segmented control: brand glass, horizontally scrollable on tight widths. */}
        <div className="mb-3 -mx-1 px-1 overflow-x-auto no-scrollbar">
          <div className="inline-flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 min-w-full">
            {TABS.map((t) => {
              const active = t.key === tab;
              const count = t.key === 'watchlist' && watchlist.length > 0 ? watchlist.length : null;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setOpenSymbol(null);
                  }}
                  aria-pressed={active}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    active ? 'bg-[#0066FF] text-white shadow-sm' : 'text-white/55 hover:text-white/80'
                  }`}
                >
                  {t.label}
                  {count != null && (
                    <span className={`ml-1 tabular-nums ${active ? 'text-white/80' : 'text-white/40'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top movers (hidden when the feed has no real change data) */}
        {!loading && !unavailable && rows.length > 0 && (
          <MoversStrip
            rows={rows}
            onPick={(symbol) => setOpenSymbol((cur) => (cur === symbol ? null : symbol))}
          />
        )}

        {/* List */}
        <div className="max-h-[70vh] overflow-y-auto no-scrollbar -mx-1 px-1">
          {loading && (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          )}

          {!loading && unavailable && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <div className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center mb-3">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0066FF' }} />
              </div>
              <div className="text-[15px] font-semibold text-white">Live market data coming online</div>
              <div className="text-xs text-white/45 mt-1 max-w-xs">
                {data && !data.available && data.reason
                  ? data.reason.replace(/^./, (c) => c.toUpperCase())
                  : 'Real time equities and real-world assets appear here once the feed connects.'}
              </div>
            </div>
          )}

          {!loading && !unavailable && rows.length === 0 && tab === 'watchlist' && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <Star className="w-6 h-6 text-white/25 mb-3" />
              <div className="text-[15px] font-semibold text-white">
                {canStar ? 'Your watchlist is empty' : 'Sign in to build a watchlist'}
              </div>
              <div className="text-xs text-white/45 mt-1 max-w-xs">
                {canStar
                  ? 'Tap the star on any ticker to pin it here. Saved on this device.'
                  : 'Signed-in members can star tickers to keep them close. Saved on this device.'}
              </div>
            </div>
          )}

          {!loading && !unavailable && rows.length === 0 && tab !== 'watchlist' && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <div className="text-[15px] font-semibold text-white">Nothing to show yet</div>
              <div className="text-xs text-white/45 mt-1 max-w-xs">
                The current feed has no priced tickers for this category right now.
              </div>
            </div>
          )}

          {!loading && !unavailable && rows.length > 0 && (
            <div>
              {rows.map((r) => (
                <Row
                  key={`${r.section}-${r.symbol}`}
                  row={r}
                  open={openSymbol === r.symbol}
                  onToggle={() => setOpenSymbol((cur) => (cur === r.symbol ? null : r.symbol))}
                  starred={starred.has(r.symbol)}
                  canStar={canStar}
                  onToggleStar={() => toggleStar(r.symbol)}
                  lazy={history[r.symbol]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
