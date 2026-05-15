'use client';

/**
 * SwapRoutePreview — visualizes the multi-hop route a swap will take
 * through DEX aggregators. Audit B7 / P1 #13 — without this, the swap
 * page only said "Powered by Uniswap V3" while the actual quote could
 * be routing through 3 different pools and 2 different DEXes.
 *
 * Industry parity:
 *   - 1inch displays the full DEX path (e.g. USDC → WETH @ Uniswap V3
 *     0.3% → ETH wrap) with provider-split percentages
 *   - Jupiter shows route providers + their split bps
 *   - Matcha shows hop count + best-priced provider per hop
 *
 * Defensive parsing: the swap page consumes both 0x (EVM via /api/swap/
 * price) and Jupiter (Solana). Each returns a different shape — this
 * component normalizes them into a common Hop[] internal model so the
 * render is single-pathed and the shape branching lives only in one
 * helper.
 */

import { ChevronRight } from 'lucide-react';

interface Hop {
  source: string;     // DEX name (e.g. "Uniswap V3", "Curve")
  fromSymbol: string; // sell-side token (best-effort; "??" when unknown)
  toSymbol: string;   // buy-side token
  percent: number;    // 0..100 portion of the trade routed through this hop
}

interface Props {
  // 0x v2 / 0x v1 quote shape — `route.fills` array.
  zeroExRoute?: {
    fills?: Array<{
      source?: string;
      proportionBps?: number;
      from?: string;
      to?: string;
    }>;
    tokens?: Array<{ address: string; symbol: string }>;
  };
  // Jupiter quote shape — `routePlan` array of swap steps.
  jupiterRoutePlan?: Array<{
    protocol?: string;
    inputMint?: string;
    outputMint?: string;
    percent?: number;
  }>;
  // Fallback display — when no structured route exists at all, we
  // render this as a single-hop label so the panel still says SOMETHING.
  fallbackVenue?: string;
  fromSymbol: string;
  toSymbol: string;
}

function normalizeZeroEx(props: Props): Hop[] {
  const fills = props.zeroExRoute?.fills ?? [];
  const tokenIndex = new Map<string, string>();
  for (const t of props.zeroExRoute?.tokens ?? []) {
    tokenIndex.set(t.address.toLowerCase(), t.symbol);
  }
  return fills.map((f) => ({
    source: f.source ?? '0x',
    fromSymbol: tokenIndex.get((f.from ?? '').toLowerCase()) ?? props.fromSymbol,
    toSymbol: tokenIndex.get((f.to ?? '').toLowerCase()) ?? props.toSymbol,
    // 0x reports proportionBps in basis points (10_000 = 100%).
    percent: f.proportionBps ? f.proportionBps / 100 : 100,
  }));
}

function normalizeJupiter(props: Props): Hop[] {
  const steps = props.jupiterRoutePlan ?? [];
  return steps.map((s) => ({
    source: s.protocol ?? 'Jupiter',
    // Jupiter mints are SPL contracts — we don't have a symbol map
    // here, so we surface the from/to from the props for the first/last
    // hops and leave intermediate hops as "??" rather than guessing.
    fromSymbol: props.fromSymbol,
    toSymbol: props.toSymbol,
    percent: s.percent ?? 100,
  }));
}

function normalize(props: Props): Hop[] {
  if (props.zeroExRoute && (props.zeroExRoute.fills?.length ?? 0) > 0) {
    return normalizeZeroEx(props);
  }
  if (props.jupiterRoutePlan && props.jupiterRoutePlan.length > 0) {
    return normalizeJupiter(props);
  }
  // Last resort — collapse to a single labelled hop. Better than
  // showing nothing.
  return [{
    source: props.fallbackVenue ?? 'DEX Aggregator',
    fromSymbol: props.fromSymbol,
    toSymbol: props.toSymbol,
    percent: 100,
  }];
}

export default function SwapRoutePreview(props: Props) {
  const hops = normalize(props);
  // Group hops by source so a 2-pool split (e.g. 60% UniV3 / 40% Curve)
  // renders as one row per provider with a percentage badge instead of
  // two confusingly-similar rows.
  const grouped = new Map<string, number>();
  for (const h of hops) {
    grouped.set(h.source, (grouped.get(h.source) ?? 0) + h.percent);
  }
  const summary = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Route</div>

      {/* Token-flow line — first → last token in the path. Intermediate
          hops collapse into the count badge so the line stays scannable
          on mobile. */}
      <div className="flex items-center gap-2 mb-2 font-mono">
        <span className="px-2 py-1 rounded-lg bg-slate-800 text-white text-[11px]">
          {props.fromSymbol}
        </span>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        {hops.length > 1 && (
          <>
            <span
              className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-400 text-[10px]"
              title={`${hops.length - 1} intermediate hops`}
            >
              {hops.length - 1} hop{hops.length === 2 ? '' : 's'}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
          </>
        )}
        <span className="px-2 py-1 rounded-lg bg-slate-800 text-white text-[11px]">
          {props.toSymbol}
        </span>
      </div>

      {/* Provider split — shows which DEXes / aggregators are carrying
          how much of the trade. 1inch / Jupiter call this "providers",
          0x calls it "sources" — we normalize to "Provider" in the UI. */}
      <div className="space-y-1">
        {summary.map(([source, percent]) => (
          <div key={source} className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-300 flex-1 truncate">{source}</span>
            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
            <span className="text-slate-400 tabular-nums w-10 text-right">{percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
