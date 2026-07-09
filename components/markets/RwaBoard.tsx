'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * RwaBoard — the real world assets / TradFi surface.
 *
 * iOS-Stocks style glass board: sections (Indices, Stocks, Commodities), each
 * row shows symbol + name, a tiny inline SVG sparkline, price and a colored
 * change chip (emerald up / red down). Honest loading + unavailable states;
 * NEVER renders a fabricated price. Reads /api/markets/rwa.
 *
 * Export contract: `export default function RwaBoard()` — no props. Drop it in
 * anywhere (the dashboard Markets tab renders it directly).
 */

type Section = 'indices' | 'stocks' | 'commodities';

interface RwaRow {
  section: Section;
  symbol: string;
  name: string;
  price: number;
  changeAbs: number;
  changePct: number;
  spark: number[];
  asOf: string | null;
}

type ApiResponse =
  | { available: true; asOf: string; rows: RwaRow[] }
  | { available: false; reason: string };

const UP = '#10B981';
const DOWN = '#EF4444';

const SECTION_META: Array<{ key: Section; label: string }> = [
  { key: 'indices', label: 'Indices' },
  { key: 'stocks', label: 'Stocks' },
  { key: 'commodities', label: 'Commodities' },
];

// ─── Formatting (every number guarded before toFixed) ─────────────────────────

function fmtPrice(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return '--';
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChangeAbs(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}`;
}

function fmtChangePct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '--';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Tiny inline SVG sparkline ────────────────────────────────────────────────

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const w = 64;
  const h = 24;
  if (!data || data.length < 2) {
    return <svg width={w} height={h} aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / span) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const color = up ? UP : DOWN;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="overflow-visible">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({ row }: { row: RwaRow }) {
  const up = (row.changePct ?? 0) >= 0;
  const chipColor = up ? UP : DOWN;
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-white/[0.05] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-white truncate">{row.symbol}</div>
        <div className="text-xs text-white/45 truncate">{row.name}</div>
      </div>

      <div className="shrink-0 hidden sm:block">
        <Sparkline data={row.spark} up={up} />
      </div>

      <div className="flex flex-col items-end shrink-0 min-w-[92px]">
        <div className="text-[15px] font-semibold text-white tabular-nums">{fmtPrice(row.price)}</div>
        <div
          className="mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums"
          style={{ color: '#fff', backgroundColor: chipColor }}
        >
          {fmtChangePct(row.changePct)}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-white/[0.05] last:border-b-0">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-16 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
      </div>
      <div className="h-6 w-16 rounded bg-white/[0.06] animate-pulse hidden sm:block" />
      <div className="flex flex-col items-end space-y-2 min-w-[92px]">
        <div className="h-4 w-20 rounded bg-white/10 animate-pulse" />
        <div className="h-4 w-14 rounded bg-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export default function RwaBoard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

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
    // Refresh in step with the server cache window.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const asOf = data && data.available ? fmtDate(data.asOf) : fmtDate(new Date().toISOString());

  const bySection = (section: Section): RwaRow[] =>
    data && data.available ? data.rows.filter((r) => r.section === section) : [];

  const unavailable = (!loading && errored) || (data != null && !data.available);

  return (
    <div className="nl-glass rounded-2xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-bold text-white">Markets</h2>
        {asOf && <span className="text-xs text-white/45">{asOf}</span>}
      </div>

      {/* Scroll container so the board keeps its own height on mobile */}
      <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1">
        {loading && (
          <div>
            {SECTION_META.map((s) => (
              <div key={s.key} className="mb-4 last:mb-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                  {s.label}
                </div>
                {Array.from({ length: s.key === 'stocks' ? 4 : 2 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading && unavailable && (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center mb-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#0066FF' }}
              />
            </div>
            <div className="text-[15px] font-semibold text-white">Live market data coming online</div>
            <div className="text-xs text-white/45 mt-1 max-w-xs">
              {data && !data.available && data.reason
                ? data.reason.replace(/^./, (c) => c.toUpperCase())
                : 'Real time indices, stocks and commodities appear here once the feed connects.'}
            </div>
          </div>
        )}

        {!loading && !unavailable && (
          <div>
            {SECTION_META.map((s) => {
              const rows = bySection(s.key);
              if (rows.length === 0) return null;
              return (
                <div key={s.key} className="mb-4 last:mb-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                    {s.label}
                  </div>
                  {rows.map((r) => (
                    <Row key={`${r.section}-${r.symbol}`} row={r} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
