'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '@/lib/cinematic/sound';

type Seal = {
  seal_date: string;
  title: string;
  body: string;
  generated_at: string;
};

/**
 * DailySeal — the Oracle's headline component.
 *
 * Renders a wax-seal SVG over the day's briefing. Click "Break the seal" and
 * the wax cracks open with a cinematic reveal — the title fades in first,
 * then the body in an ink-writing line-by-line cadence. The "broken" state
 * persists per-day in localStorage so returning visitors see the briefing
 * straight away and can re-seal it manually if they want the ritual back.
 */
export function DailySeal() {
  const [seal, setSeal] = useState<Seal | null | 'loading'>('loading');
  const [broken, setBroken] = useState(false);
  const [staleDays, setStaleDays] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cult/oracle/daily-seal', { cache: 'no-store' });
        const j = await res.json();
        if (cancelled) return;
        const next: Seal | null = j.seal ?? null;
        setSeal(next);
        // Only mark stale when the seal is older than 48h, so a weeks-old
        // seal is never presented as today's briefing.
        setStaleDays(j.stale ? (typeof j.age_days === 'number' ? j.age_days : null) : null);
        if (next) {
          const lsKey = `naka_oracle_seal_broken_${next.seal_date}`;
          if (typeof window !== 'undefined' && window.localStorage.getItem(lsKey) === '1') {
            setBroken(true);
          }
        }
      } catch {
        if (!cancelled) setSeal(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function breakSeal() {
    if (!seal || typeof seal === 'string') return;
    setBroken(true);
    playSound('daily-seal');
    try {
      window.localStorage.setItem(`naka_oracle_seal_broken_${seal.seal_date}`, '1');
    } catch { /* localStorage unavailable */ }
  }

  function reseal() {
    if (!seal || typeof seal === 'string') return;
    setBroken(false);
    try {
      window.localStorage.removeItem(`naka_oracle_seal_broken_${seal.seal_date}`);
    } catch { /* noop */ }
  }

  if (seal === 'loading') {
    return (
      <article className="oracle-seal oracle-seal--loading">
        <div className="nl-loader" aria-label="Reading the seal" />
      </article>
    );
  }

  if (!seal) {
    return (
      <article className="oracle-seal oracle-seal--empty">
        <WaxSealSVG sealed />
        <h3 className="cinematic-heading text-lg mt-4">The Oracle is silent</h3>
        <p className="text-[13px] text-[#B4C0E0] mt-1">No seal has been cast yet. The first will appear at dawn UTC.</p>
      </article>
    );
  }

  return (
    <article className={`oracle-seal ${broken ? 'oracle-seal--broken' : 'oracle-seal--sealed'}`}>
      <header className="oracle-seal__date">
        <span className="text-[10px] uppercase tracking-[0.24em] text-[#FFD86B]">
          {staleDays != null ? 'Last Seal' : 'Daily Seal'}
        </span>
        <span className="text-[11px] text-[#B4C0E0]">{formatDate(seal.seal_date)}</span>
        {staleDays != null && (
          <span
            className="rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FBBF24]"
            title="The Oracle has not cast a new seal recently."
          >
            {staleDays}d ago · awaiting dawn
          </span>
        )}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {!broken && (
          <motion.button
            key="sealed"
            type="button"
            onClick={breakSeal}
            className="oracle-seal__sealed"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.4, rotate: 8 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Break the seal to reveal today's briefing"
          >
            <WaxSealSVG sealed />
            <span className="oracle-seal__cta">Break the seal</span>
          </motion.button>
        )}

        {broken && (
          <motion.div
            key="broken"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="oracle-seal__content"
          >
            <h2 className="oracle-seal__title">{seal.title}</h2>
            <InkBody body={seal.body} />
            <button type="button" onClick={reseal} className="oracle-seal__reseal">↺ Re-seal</button>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

// Body text revealed line-by-line with a soft ink-write cadence.
function InkBody({ body }: { body: string }) {
  const lines = body.split('\n').filter(Boolean);
  return (
    <div className="oracle-seal__body">
      {lines.map((line, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {line}
        </motion.p>
      ))}
    </div>
  );
}

function WaxSealSVG({ sealed }: { sealed: boolean }) {
  return (
    <svg viewBox="0 0 120 120" width={120} height={120} aria-hidden="true">
      <defs>
        <radialGradient id="oracle-wax" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#FF6E8A" />
          <stop offset="55%"  stopColor="#DC143C" />
          <stop offset="100%" stopColor="#7A0A20" />
        </radialGradient>
        <filter id="oracle-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#oracle-glow)">
        <circle cx="60" cy="60" r="46" fill="url(#oracle-wax)" />
        {/* Sigil — concentric octagonal mark */}
        <polygon points="60,28 80,40 88,60 80,80 60,92 40,80 32,60 40,40"
          fill="none" stroke="#FFD86B" strokeWidth="1.5" opacity={sealed ? 1 : 0.4} />
        <circle cx="60" cy="60" r="14" fill="none" stroke="#FFD86B" strokeWidth="1.5" opacity={sealed ? 1 : 0.4} />
        <circle cx="60" cy="60" r="3"  fill="#FFD86B" opacity={sealed ? 1 : 0.6} />
      </g>
    </svg>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
