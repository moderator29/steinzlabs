'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Users2, Check, Loader2 } from 'lucide-react';
import { SymbolBadge } from '@/components/predict/SymbolBadge';
import { Countdown } from '@/components/predict/Countdown';
import { useNow } from '@/components/predict/hooks';
import { formatUsd } from '@/components/predict/utils';
import { formatWireCount } from '@/lib/wire/format';
import type { WirePrediction as WirePredictionType } from './WirePostCard';

/**
 * WirePrediction - a wire's inline mini-prediction ("call"), rendered in the
 * brand Predict style. Shows the symbol, the direction/target, the reference
 * price at creation, a live countdown to resolution, and an idempotent Agree
 * control with the live agree count. Outcomes are resolved elsewhere (a cron);
 * here an open call simply counts down.
 */
export function WirePrediction({
  prediction,
  currentUserId,
}: {
  prediction: WirePredictionType;
  currentUserId?: string | null;
}) {
  const now = useNow();
  const reduced = useReducedMotion();
  const [agreed, setAgreed] = useState(!!prediction.agreed);
  const [count, setCount] = useState(prediction.agreeCount ?? 0);
  const [busy, setBusy] = useState(false);

  const up = prediction.direction === 'above';
  const open = prediction.status === 'open';
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  const accent = up ? '#10B981' : '#F43F5E';

  const toggle = async () => {
    if (!currentUserId || busy) return;
    const next = !agreed;
    setBusy(true);
    setAgreed(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await fetch(`/api/wire/predictions/${prediction.id}/agree`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error('agree failed');
      const j = await res.json();
      if (typeof j.agreeCount === 'number') setCount(j.agreeCount);
      if (typeof j.agreed === 'boolean') setAgreed(j.agreed);
    } catch {
      setAgreed(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-3 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
    >
      {/* direction accent spine */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent, opacity: 0.9 }} aria-hidden />
      <div className="p-3 ps-4">
        <div className="flex items-center gap-2.5">
          <SymbolBadge symbol={prediction.symbol} size={34} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
              <span className="uppercase tracking-wide text-[10px] font-bold text-white/45">Call</span>
              <span className="truncate">
                {prediction.symbol} {up ? 'above' : 'below'} {formatUsd(prediction.target)}
              </span>
              <Arrow className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
            </div>
            <div className="mt-0.5 text-[11px] text-white/45 tabular-nums">
              {prediction.priceAtCreate != null ? (
                <>at call {formatUsd(prediction.priceAtCreate)}</>
              ) : (
                <>reference price unavailable</>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            {open ? (
              <Countdown closesAt={prediction.resolvesAt} now={now} size="sm" />
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                {prediction.status}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            disabled={!currentUserId || busy}
            aria-pressed={agreed}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
              agreed
                ? 'border border-[#0066FF]/50 bg-[#0066FF]/20 text-white'
                : 'border border-white/12 text-white/70 hover:text-white hover:border-white/25'
            }`}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {agreed ? 'Agreed' : 'Agree'}
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
            <Users2 className="w-3.5 h-3.5" />
            <span className="tabular-nums">{formatWireCount(count)}</span> agree
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default WirePrediction;
