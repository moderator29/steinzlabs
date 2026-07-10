'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Grid2x2, RefreshCw } from 'lucide-react';
import { buildDetailHref } from '@/lib/market/tokenChainResolver';

/**
 * MarketHeatmap — a finviz/iOS-Stocks style treemap of the top tokens.
 *
 * Tiles are SIZED by market cap (squarified treemap → honest proportional
 * area, perfect tiling) and COLORED by 24h change (emerald up / red down,
 * with the numeric % + an arrow on every readable tile so the signal never
 * relies on color alone). Clicking a tile deep-links to the token's detail
 * page via the shared chain resolver.
 *
 * Data: the SAME source the market table already uses —
 * GET /api/market-data?category=top&limit=100. No new/paid source.
 * Honest loading + empty states; never fabricates a tile.
 */

interface HeatToken {
  id: string;
  symbol: string;
  name: string;
  marketCap: number;
  change24h: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TILE_COUNT = 40;

// ─── Diverging color scale (emerald ↑ / red ↓, neutral slate at 0) ────────────
// Discrete steps keep it accessible — each band is a clearly distinct shade and
// every readable tile also carries the numeric %, so color is never the only cue.
function tileColor(change: number): string {
  if (change >= 5) return '#059669';
  if (change >= 2) return '#0f9d6e';
  if (change >= 0.5) return '#1f7a5c';
  if (change > -0.5) return '#31384f'; // neutral
  if (change > -2) return '#7a2f38';
  if (change > -5) return '#b23a48';
  return '#d1394a';
}

function fmtMcap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// ─── Squarified treemap (Bruls, Huizing, van Wijk) ────────────────────────────
// Lays out `values` inside `bounds` so tiles stay as square as possible while
// their AREAS stay proportional to value. Returns one Rect per input value.
function squarify(values: number[], bounds: Rect): Rect[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const area = bounds.w * bounds.h;
  const scaled = values.map((v) => (v / total) * area);

  const out: Rect[] = new Array(values.length);
  let idx = 0;
  const rect = { ...bounds };

  const worst = (row: number[], side: number): number => {
    const sum = row.reduce((s, v) => s + v, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    const s2 = side * side;
    const sum2 = sum * sum;
    return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
  };

  const layoutRow = (row: number[], startIdx: number) => {
    const sum = row.reduce((s, v) => s + v, 0);
    const horizontal = rect.w >= rect.h;
    if (horizontal) {
      const rowW = sum / rect.h;
      let y = rect.y;
      for (let i = 0; i < row.length; i++) {
        const h = (row[i] / sum) * rect.h;
        out[startIdx + i] = { x: rect.x, y, w: rowW, h };
        y += h;
      }
      rect.x += rowW;
      rect.w -= rowW;
    } else {
      const rowH = sum / rect.w;
      let x = rect.x;
      for (let i = 0; i < row.length; i++) {
        const w = (row[i] / sum) * rect.w;
        out[startIdx + i] = { x, y: rect.y, w, h: rowH };
        x += w;
      }
      rect.y += rowH;
      rect.h -= rowH;
    }
  };

  while (idx < scaled.length) {
    let row: number[] = [];
    let rowStart = idx;
    let side = Math.min(rect.w, rect.h);
    while (idx < scaled.length) {
      const next = [...row, scaled[idx]];
      if (row.length > 0 && worst(next, side) > worst(row, side)) break;
      row = next;
      idx++;
      side = Math.min(rect.w, rect.h);
    }
    layoutRow(row, rowStart);
  }
  return out;
}

export default function MarketHeatmap() {
  const router = useRouter();
  const [tokens, setTokens] = useState<HeatToken[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/market-data?category=top&limit=100', {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { tokens?: Array<Record<string, unknown>> };
        if (cancelled) return;
        const rows: HeatToken[] = (json.tokens ?? [])
          .map((t) => ({
            id: String(t.id ?? ''),
            symbol: String(t.symbol ?? '').toUpperCase(),
            name: String(t.name ?? ''),
            marketCap: Number(t.marketCap ?? 0),
            change24h: Number(t.change24h ?? 0),
          }))
          .filter((t) => t.id && t.marketCap > 0)
          .sort((a, b) => b.marketCap - a.marketCap)
          .slice(0, TILE_COUNT);
        setTokens(rows);
        setStatus(rows.length > 0 ? 'ready' : 'empty');
      } catch {
        if (!cancelled) {
          setTokens([]);
          setStatus('empty');
        }
      }
    };
    void load();
    const t = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Measure the tiling area so squarify's aspect ratio matches real pixels.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  const rects = useMemo(() => {
    if (tokens.length === 0 || size.w === 0 || size.h === 0) return [];
    return squarify(
      tokens.map((t) => t.marketCap),
      { x: 0, y: 0, w: size.w, h: size.h },
    );
  }, [tokens, size]);

  return (
    <div className="nl-glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0066FF]/10 flex items-center justify-center">
            <Grid2x2 className="w-3.5 h-3.5 text-[#4D6BFF]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Market Heatmap</h3>
            <p className="text-[10px] text-gray-500">Top {TILE_COUNT} by market cap · sized by cap, colored by 24h</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#059669' }} /> Up</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#31384f' }} /> Flat</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#d1394a' }} /> Down</span>
        </div>
      </div>

      <div className="p-2">
        <div
          ref={containerRef}
          className="relative w-full h-[320px] sm:h-[380px] lg:h-[440px] rounded-lg overflow-hidden"
        >
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin text-[#0066FF]" />
              <span className="text-xs">Loading market heatmap…</span>
            </div>
          )}

          {status === 'empty' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
              <Grid2x2 className="w-7 h-7 text-gray-600" />
              <p className="text-sm text-gray-400">Heatmap data unavailable right now.</p>
              <p className="text-[11px] text-gray-600">The market source will reconnect automatically.</p>
            </div>
          )}

          {status === 'ready' &&
            tokens.map((t, i) => {
              const r = rects[i];
              if (!r || r.w <= 0 || r.h <= 0) return null;
              const areaOk = r.w > 46 && r.h > 34;
              const bigTile = r.w > 88 && r.h > 60;
              const pos = t.change24h >= 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(buildDetailHref({ id: t.id, symbol: t.symbol }))}
                  title={`${t.name} · ${fmtMcap(t.marketCap)} · ${pos ? '+' : ''}${t.change24h.toFixed(2)}%`}
                  className="absolute flex flex-col items-center justify-center overflow-hidden text-white/95 transition-[filter,transform] duration-150 hover:z-10 hover:brightness-125 focus:outline-none focus:z-10 focus:ring-2 focus:ring-white/60"
                  style={{
                    left: `${r.x}px`,
                    top: `${r.y}px`,
                    width: `${r.w}px`,
                    height: `${r.h}px`,
                    background: tileColor(t.change24h),
                    padding: '2px',
                    // hairline gaps between tiles without breaking the tiling
                    boxShadow: 'inset 0 0 0 1px rgba(5,8,22,0.55)',
                  }}
                >
                  {areaOk && (
                    <>
                      <span className="font-bold leading-none tracking-tight" style={{ fontSize: bigTile ? 14 : 11 }}>
                        {t.symbol}
                      </span>
                      <span className="font-mono leading-none mt-0.5" style={{ fontSize: bigTile ? 12 : 9.5 }}>
                        {pos ? '+' : ''}{t.change24h.toFixed(bigTile ? 2 : 1)}%
                      </span>
                      {bigTile && (
                        <span className="font-mono leading-none mt-0.5 text-white/70" style={{ fontSize: 9.5 }}>
                          {fmtMcap(t.marketCap)}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
