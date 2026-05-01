"use client";

/**
 * §7 — Naka Trust Score badge.
 *
 * Drop into TokenCards, swap previews, sniper rows, market table, etc.
 * Two modes:
 *   <TrustScoreBadge chain="ethereum" address="0x..." />     → fetches
 *   <TrustScoreBadge score={82} band="trusted" />             → static
 *
 * Click opens a layered breakdown popover (security / liquidity /
 * holders / market / social).
 */

import { useEffect, useState } from "react";
import { Info, Shield } from "lucide-react";

type Band = "highly_trusted" | "trusted" | "caution" | "high_risk" | "dangerous";

interface Layers {
  security: number;
  liquidity: number;
  holders: number;
  market: number;
  social: number;
}

interface ScoreData {
  score: number;
  band: Band;
  bandLabel: string;
  bandColor: string;
  layers: Layers;
}

interface Props {
  chain?: string;
  address?: string;
  score?: number;
  band?: Band;
  bandLabel?: string;
  bandColor?: string;
  layers?: Layers;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const BAND_COLOR: Record<Band, string> = {
  highly_trusted: "#10B981",
  trusted: "#3B82F6",
  caution: "#F59E0B",
  high_risk: "#F97316",
  dangerous: "#EF4444",
};
const BAND_TEXT: Record<Band, string> = {
  highly_trusted: "Highly Trusted",
  trusted: "Trusted",
  caution: "Caution",
  high_risk: "High Risk",
  dangerous: "Avoid",
};

function bandFor(score: number): Band {
  if (score >= 80) return "highly_trusted";
  if (score >= 60) return "trusted";
  if (score >= 40) return "caution";
  if (score >= 20) return "high_risk";
  return "dangerous";
}

// Module-level dedup so N badges on the same page share one fetch per
// (chain, address). Same pattern as components/whales/WhaleAvatar.
const inflight = new Map<string, Promise<ScoreData | null>>();

export function TrustScoreBadge({
  chain,
  address,
  score: initialScore,
  band: initialBand,
  bandLabel: initialBandLabel,
  bandColor: initialBandColor,
  layers: initialLayers,
  size = "md",
  showLabel = true,
  className = "",
}: Props) {
  const [data, setData] = useState<ScoreData | null>(
    initialScore != null
      ? {
          score: initialScore,
          band: initialBand ?? bandFor(initialScore),
          bandLabel: initialBandLabel ?? BAND_TEXT[initialBand ?? bandFor(initialScore)],
          bandColor: initialBandColor ?? BAND_COLOR[initialBand ?? bandFor(initialScore)],
          layers: initialLayers ?? { security: 0, liquidity: 0, holders: 0, market: 0, social: 0 },
        }
      : null,
  );
  const [loading, setLoading] = useState<boolean>(initialScore == null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (data || !chain || !address) return;
    let cancelled = false;
    const key = `${chain}:${address}`;
    let promise = inflight.get(key);
    if (!promise) {
      promise = fetch(`/api/trust-score/${chain}/${encodeURIComponent(address)}`)
        .then((r) => (r.ok ? (r.json() as Promise<ScoreData>) : null))
        .catch(() => null)
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
    }
    promise.then((j) => {
      if (cancelled) return;
      if (j) setData(j);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [chain, address, data]);

  if (loading || !data) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500 ${className}`}>
        <Shield size={11} className="opacity-60" />
        …
      </span>
    );
  }

  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ${px}`}
        style={{ background: `${data.bandColor}1F`, color: data.bandColor, border: `1px solid ${data.bandColor}55` }}
        aria-label={`Naka Trust Score ${data.score}: ${data.bandLabel}`}
      >
        <Shield size={size === "sm" ? 9 : size === "lg" ? 14 : 11} />
        {data.score}
        {showLabel && <span className="hidden sm:inline">· {data.bandLabel}</span>}
      </button>
      {open && (
        <div
          className="absolute z-30 top-full mt-2 left-0 w-64 rounded-xl border border-white/10 bg-[#0F1320] shadow-2xl p-3"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">Trust breakdown</span>
            <Info size={11} className="text-white/40" />
          </div>
          <div className="space-y-1.5">
            <Row label="Security" value={data.layers.security} weight={40} />
            <Row label="Liquidity" value={data.layers.liquidity} weight={20} />
            <Row label="Holders" value={data.layers.holders} weight={15} />
            <Row label="Market" value={data.layers.market} weight={15} />
            <Row label="Social" value={data.layers.social} weight={10} />
          </div>
        </div>
      )}
    </span>
  );
}

function Row({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-white/70 w-16">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: BAND_COLOR[bandFor(value)] }}
        />
      </div>
      <span className="text-[10px] font-mono text-white/60 w-9 text-right">{value}</span>
      <span className="text-[9px] text-white/40 w-7 text-right">{weight}%</span>
    </div>
  );
}
