import type { Direction, Market } from './types';

// ── number / money formatting ────────────────────────────────────────────────
export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  let decimals = 2;
  if (abs > 0 && abs < 1) decimals = abs < 0.01 ? 6 : 4;
  else if (abs >= 1000) decimals = 2;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${formatPrice(n)}`;
}

export function formatPoints(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-US');
}

// ── countdown ─────────────────────────────────────────────────────────────────
export interface Remaining {
  ms: number;
  mm: string;
  ss: string;
  label: string; // "mm:ss"
  closed: boolean;
}

export function remainingFrom(closesAt: string, now: number = Date.now()): Remaining {
  const t = Date.parse(closesAt);
  const ms = Number.isNaN(t) ? 0 : t - now;
  if (ms <= 0) return { ms: 0, mm: '00', ss: '00', label: '00:00', closed: true };
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return { ms, mm, ss, label: `${mm}:${ss}`, closed: false };
}

// ── question builder (mirrors the reference wording) ─────────────────────────
export function marketQuestion(m: Pick<Market, 'symbol' | 'direction' | 'target' | 'closesAt'>, now?: number): string {
  const r = remainingFrom(m.closesAt, now);
  const window = r.closed ? 'now' : `${r.mm}:${r.ss}`;
  return `Will ${m.symbol} be ${m.direction} ${formatUsd(m.target)} in ${window}?`;
}

export function directionWord(d: Direction): string {
  return d === 'above' ? 'above' : 'below';
}

// ── odds ─────────────────────────────────────────────────────────────────────
export function yesPct(probYes: number): number {
  return Math.max(1, Math.min(99, Math.round(probYes * 100)));
}

// ── deterministic brand color from a symbol (lettered avatar fallback) ───────
const AVATAR_COLORS = [
  '#0066FF', '#10B981', '#8B5CF6', '#F59E0B',
  '#EC4899', '#3B82F6', '#14B8A6', '#F43F5E',
];
export function symbolColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Pick the featured market: soonest to close among still-open markets, with the
// largest volume breaking ties. Returns null when nothing is playable.
export function pickFeatured(markets: Market[], now: number = Date.now()): Market | null {
  const open = markets.filter((m) => Date.parse(m.closesAt) - now > 0);
  if (open.length === 0) return null;
  return [...open].sort((a, b) => {
    const dt = Date.parse(a.closesAt) - Date.parse(b.closesAt);
    if (dt !== 0) return dt;
    return (b.volume || 0) - (a.volume || 0);
  })[0];
}
