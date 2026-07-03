'use client';

// AiInsightCard — the shared surface for Claude-generated on-chain insight
// across the platform (whale narratives, cluster explanations, trend theses,
// portfolio coaching, security verdicts). One consistent, on-brand look so AI
// output feels like a single intelligence layer, not scattered widgets.
//
// Visual language: glass body (.nl-glass) + an animated aurora sheen along the
// top edge + the Naka agent avatar. Streams text with a soft cursor, renders
// optional citation chips (file/onchain sources) and a confidence meter.
// Reduced-motion aware. No data fetching here — callers pass text/stream.

import { useEffect, useRef, useState } from 'react';
import { AgentAvatar } from '@/components/brand/AgentAvatar';
import { Sparkles, ExternalLink } from 'lucide-react';

export interface AiCitation {
  label: string;
  href?: string;
}

interface AiInsightCardProps {
  title?: string;
  /** Full text; when `streaming` is true it types in. */
  text: string;
  streaming?: boolean;
  loading?: boolean;
  citations?: AiCitation[];
  /** 0–100 model confidence; renders a subtle meter when provided. */
  confidence?: number;
  /** crimson variant for risk/danger verdicts */
  accent?: 'blue' | 'crimson';
  className?: string;
  footer?: React.ReactNode;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function AiInsightCard({
  title = 'VTX Insight',
  text,
  streaming = false,
  loading = false,
  citations,
  confidence,
  accent = 'blue',
  className = '',
  footer,
}: AiInsightCardProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(streaming && !reduced ? '' : text);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!streaming || reduced) { setShown(text); return; }
    let i = 0;
    const step = () => {
      // ~2 chars/frame → smooth, fast enough to feel alive without lag.
      i = Math.min(text.length, i + 2);
      setShown(text.slice(0, i));
      if (i < text.length) raf.current = requestAnimationFrame(step);
    };
    setShown('');
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [text, streaming, reduced]);

  const edge = accent === 'crimson' ? 'rgba(220,20,60,.55)' : 'rgba(0,102,255,.55)';

  return (
    <div
      className={`nl-glass relative overflow-hidden rounded-2xl p-4 sm:p-5 ${className}`}
      style={{ boxShadow: `0 0 0 1px ${edge}, 0 0 26px ${accent === 'crimson' ? 'rgba(220,20,60,.18)' : 'rgba(0,102,255,.18)'}` }}
    >
      {/* Aurora sheen along the top edge — the signature motion. */}
      {!reduced && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent === 'crimson' ? '#FF1744' : '#00C8FF'}, transparent)`,
            animation: 'nl-ai-sheen 3.2s ease-in-out infinite',
          }}
        />
      )}
      <div className="flex items-center gap-2.5 mb-3">
        <AgentAvatar size={26} animated={loading} />
        <span className="text-xs font-bold tracking-wide text-white/90 inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#00C8FF]" /> {title}
        </span>
        {typeof confidence === 'number' && (
          <span className="ms-auto inline-flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="uppercase tracking-wide">Confidence</span>
            <span className="relative h-1.5 w-14 rounded-full bg-white/10 overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, confidence))}%`,
                  background: confidence >= 66 ? '#10B981' : confidence >= 33 ? '#FFD86B' : '#FF1744',
                }}
              />
            </span>
            <span className="tabular-nums text-slate-300">{Math.round(confidence)}%</span>
          </span>
        )}
      </div>

      {loading && !text ? (
        <div className="space-y-2">
          <div className="h-3 w-11/12 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-9/12 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-10/12 rounded bg-white/[0.06] animate-pulse" />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
          {shown}
          {streaming && !reduced && shown.length < text.length && (
            <span className="inline-block w-1.5 h-4 -mb-0.5 ms-0.5 bg-[#00C8FF] animate-pulse rounded-sm" />
          )}
        </p>
      )}

      {citations && citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {citations.map((c, i) =>
            c.href ? (
              <a
                key={i}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-300 bg-white/[0.04] border border-white/[0.06] hover:border-[#0066FF]/40 hover:text-white transition-colors"
              >
                {c.label} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <span key={i} className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-medium text-slate-400 bg-white/[0.03] border border-white/[0.05]">
                {c.label}
              </span>
            ),
          )}
        </div>
      )}

      {footer && <div className="mt-3 pt-3 border-t border-white/[0.06]">{footer}</div>}
    </div>
  );
}

export default AiInsightCard;
