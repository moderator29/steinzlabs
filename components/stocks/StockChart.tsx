'use client';

import { useMemo, useState } from 'react';

/**
 * StockChart — the Apple-Stocks-style area chart, built in our brand style (no
 * external chart lib). Gradient fill under a crisp line, a dashed baseline at
 * the previous close, right-hand price labels, and a draggable crosshair that
 * reads out the value at the touched point. Green when up, rose when down.
 */

interface Point { t: number; c: number; }

export function StockChart({
  points,
  prevClose,
  up,
  height = 220,
}: {
  points: Point[];
  prevClose?: number | null;
  up: boolean;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const color = up ? '#10B981' : '#F43F5E';

  const data = useMemo(() => points.filter((p) => Number.isFinite(p.c)), [points]);
  const W = 100, H = 100;

  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const vals = data.map((p) => p.c);
    const min = Math.min(...vals, prevClose ?? Infinity);
    const max = Math.max(...vals, prevClose ?? -Infinity);
    const span = max - min || 1;
    const stepX = W / (data.length - 1);
    const toXY = (v: number, i: number) => ({ x: i * stepX, y: H - ((v - min) / span) * H });
    const pts = data.map((p, i) => toXY(p.c, i));
    const line = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const area = `0,${H} ${line} ${W},${H}`;
    const baselineY = prevClose != null ? H - ((prevClose - min) / span) * H : null;
    return { pts, line, area, baselineY, min, max, span, stepX };
  }, [data, prevClose]);

  if (!geom) {
    return (
      <div className="flex items-center justify-center text-white/40 text-sm" style={{ height }}>
        No chart data for this range.
      </div>
    );
  }

  const gid = `stk-grad-${up ? 'up' : 'dn'}`;
  const hi = geom.max, lo = geom.min;
  const priceLabels = [hi, hi - geom.span * 0.33, hi - geom.span * 0.66, lo];

  const hoverPt = hover != null ? geom.pts[hover] : null;
  const hoverVal = hover != null ? data[hover].c : null;
  const hoverTime = hover != null ? data[hover].t : null;

  const onMove = (clientX: number, rect: DOMRect) => {
    const rel = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHover(Math.round(rel * (data.length - 1)));
  };

  return (
    <div className="flex gap-2" style={{ height }}>
      <div
        className="relative flex-1"
        onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchEnd={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" role="img" aria-label="Price chart">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {geom.baselineY != null && (
            <line x1="0" y1={geom.baselineY} x2={W} y2={geom.baselineY} stroke={color} strokeOpacity={0.35} strokeWidth={0.4} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          )}
          <polygon points={geom.area} fill={`url(#${gid})`} />
          <polyline points={geom.line} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {hoverPt && (
            <>
              <line x1={hoverPt.x} y1={0} x2={hoverPt.x} y2={H} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
              <circle cx={hoverPt.x} cy={hoverPt.y} r={2.4} fill={color} stroke="#0a0e1a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {hoverVal != null && (
          <div className="pointer-events-none absolute top-1 left-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-mono text-white backdrop-blur">
            {hoverVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {hoverTime ? <span className="ml-2 text-white/45">{new Date(hoverTime * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span> : null}
          </div>
        )}
      </div>
      {/* Right price axis */}
      <div className="flex w-16 flex-col justify-between py-0.5 text-right text-[11px] font-mono text-white/55">
        {priceLabels.map((p, i) => (
          <span key={i} className="tabular-nums">{p.toLocaleString(undefined, { maximumFractionDigits: p >= 1000 ? 0 : 2 })}</span>
        ))}
      </div>
    </div>
  );
}
