'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CandlestickChart } from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';

/**
 * StocksBoard: the home **Stocks** sub-tab surface.
 *
 * Real equity + tokenized real-world-asset prices from /api/markets/rwa. Adds
 * an in-board segmented control (Stocks / RWA / AI stocks) and a tap-to-expand
 * price chart drawn from the real daily series the feed already returns.
 *
 * Real data only. Twelve Data supplies quotes, daily change and a 30 point
 * series. The keyless Pyth fallback supplies a real spot price but no daily
 * change and no series, so those rows honestly omit the change chip and show an
 * honest empty state in place of a chart. Nothing is fabricated.
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
}

type ApiResponse =
  | { available: true; source: 'twelvedata' | 'pyth'; asOf: string; rows: RwaRow[] }
  | { available: false; reason: string };

const UP = '#10B981';
const DOWN = '#EF4444';

// ─── Board sub-tabs ──────────────────────────────────────────────────────────
// AI stocks are the AI-exposed names the owner called out. Only tickers the
// feed can actually price ever appear, so the intersection with the live
// universe is what shows (never a padded or invented row).

type TabKey = 'stocks' | 'rwa' | 'ai';

const AI_SYMBOLS = new Set(['NVDA', 'MSFT', 'GOOGL', 'AMD']);

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'stocks', label: 'Stocks' },
  { key: 'rwa', label: 'RWA' },
  { key: 'ai', label: 'AI stocks' },
];

function matchesTab(row: RwaRow, tab: TabKey): boolean {
  switch (tab) {
    case 'stocks':
      return row.section === 'indices' || row.section === 'stocks';
    case 'rwa':
      return row.section === 'commodities';
    case 'ai':
      return AI_SYMBOLS.has(row.symbol);
  }
}

// ─── Formatting (every number guarded before toFixed) ────────────────────────

function fmtPrice(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return '—';
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
}: {
  row: RwaRow;
  open: boolean;
  onToggle: () => void;
}) {
  const hasChange = row.changePct != null && Number.isFinite(row.changePct);
  const up = (row.changePct ?? 0) >= 0;
  const hasSeries = row.spark.filter((n) => Number.isFinite(n)).length >= 2;

  return (
    <div className="border-b border-white/[0.05] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 py-3 px-1 text-left transition-colors hover:bg-white/[0.03] rounded-lg"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-white truncate">{row.symbol}</div>
          <div className="text-xs text-white/45 truncate">{row.name}</div>
        </div>

        {hasSeries && (
          <div className="shrink-0 hidden sm:block">
            <Sparkline data={row.spark} width={64} height={24} stroke={up ? UP : DOWN} />
          </div>
        )}

        <div className="flex flex-col items-end shrink-0 min-w-[84px]">
          <div className="text-[15px] font-semibold text-white tabular-nums">{fmtPrice(row.price)}</div>
          {hasChange ? (
            <div
              className="mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white"
              style={{ backgroundColor: up ? UP : DOWN }}
            >
              {fmtChangePct(row.changePct)}
            </div>
          ) : (
            <div className="mt-0.5 text-[11px] text-white/35">Spot price</div>
          )}
        </div>
      </button>

      {open && (
        <div className="px-1 pb-4 pt-1">
          {hasSeries ? (
            <>
              <PriceChart data={row.spark} up={up} />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-white/45">30 day trend</span>
                {hasChange && (
                  <span className="font-semibold tabular-nums" style={{ color: up ? UP : DOWN }}>
                    {fmtChangeAbs(row.changeAbs)} ({fmtChangePct(row.changePct)})
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-6 text-center">
              <div className="text-[13px] font-semibold text-white/80">Chart unavailable</div>
              <div className="text-xs text-white/45 mt-1">
                The current feed provides a live spot price only, with no daily series to plot.
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
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [tab, setTab] = useState<TabKey>('stocks');
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);

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

  const asOf = data && data.available ? fmtDate(data.asOf) : '';
  const sourceLabel =
    data && data.available ? (data.source === 'pyth' ? 'Pyth' : 'Twelve Data') : null;

  const rows = useMemo(
    () => (data && data.available ? data.rows.filter((r) => matchesTab(r, tab)) : []),
    [data, tab],
  );

  const unavailable = (!loading && errored) || (data != null && !data.available);

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
                </button>
              );
            })}
          </div>
        </div>

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

          {!loading && !unavailable && rows.length === 0 && (
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
