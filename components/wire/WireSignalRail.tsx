'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity } from 'lucide-react';

/**
 * SignalRail - the glowing left rail that gives every wire its "signal-native"
 * spine. Its brightness and glow scale with the author's signal score (0-100),
 * and a soft highlight streams down it (live-forward feel) unless the viewer
 * prefers reduced motion. Purely decorative.
 */
export function SignalRail({ signal }: { signal?: number | null }) {
  const reduced = useReducedMotion();
  const s = typeof signal === 'number' ? Math.max(0, Math.min(100, signal)) : 0;
  const intensity = 0.28 + (s / 100) * 0.72; // 0.28 (quiet) .. 1 (loud)
  const glow = 5 + s * 0.14;

  return (
    <div aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full overflow-hidden">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(to bottom, #1E90FF, #0066FF)',
          opacity: intensity,
          boxShadow: `0 0 ${glow}px rgba(0,102,255,${0.32 * intensity})`,
        }}
      />
      {!reduced && s > 0 ? (
        <motion.div
          className="absolute inset-x-0 h-6 rounded-full"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(180,220,255,0.9), transparent)' }}
          initial={{ y: '-120%' }}
          animate={{ y: '360%' }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
        />
      ) : null}
    </div>
  );
}

/**
 * SignalChip - the compact 0-100 reputation badge shown by an author's name.
 * Transparent by design: it is the real, computed `authorSignal`. Hidden when
 * the score is unavailable rather than shown as a fake zero.
 */
export function SignalChip({ signal }: { signal?: number | null }) {
  const [open, setOpen] = useState(false);
  if (typeof signal !== 'number' || !Number.isFinite(signal)) return null;
  const s = Math.round(Math.max(0, Math.min(100, signal)));
  // Honest tier label off the real score — no fabricated wording.
  const tier = s >= 80 ? 'Elite signal' : s >= 60 ? 'Strong signal' : s >= 40 ? 'Building signal' : s >= 20 ? 'Emerging signal' : 'New signal';

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Signal score ${s} of 100`}
        aria-expanded={open}
        onClick={(e) => {
          // Tap explains the score in place; never let it bubble up to the
          // card's "open post" handler (that used to feel like a mis-click).
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-0.5 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-1.5 py-[1px] text-[10px] font-semibold text-[#8fb6ff] tabular-nums leading-none transition-colors hover:bg-[#0066FF]/20"
      >
        <Activity className="w-2.5 h-2.5" />
        {s}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <span
            role="tooltip"
            className="absolute left-0 top-6 z-50 w-56 rounded-xl border border-white/10 bg-[#0d1120] p-3 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
              <Activity className="h-3.5 w-3.5 text-[#4d94ff]" />
              {tier} · {s}/100
            </span>
            <span className="mt-1 block text-[11px] leading-relaxed text-white/55">
              A transparent 0-100 reputation from this author&apos;s real on-platform activity. Higher means more consistent, credible signal.
            </span>
          </span>
        </>
      ) : null}
    </span>
  );
}

export default SignalRail;
