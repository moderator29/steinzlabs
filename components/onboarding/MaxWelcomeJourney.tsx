'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Crown, Sparkles, ShieldCheck, Check } from 'lucide-react';

/**
 * MaxWelcomeJourney — the gold first-run welcome for new Max-plan members.
 *
 * Shown ONCE, only the first time a user reaches the Max plan (industry
 * standard: never on a returning login). The gate is server-side:
 * /api/user/tier returns { isMax, maxWelcomedAt, tierSource } and this renders
 * only when isMax && maxWelcomedAt === null. On finish/skip it POSTs
 * /api/user/max-welcomed to stamp the flag so it never returns. Existing Max
 * holders were backfilled at migration time, so only genuine first-time
 * unlocks see it. Non-Max users never see this — they keep the standard
 * platform onboarding.
 */

interface TierInfo {
  isMax?: boolean;
  maxWelcomedAt?: string | null;
  tierSource?: string | null;
  isCult?: boolean;
}

const STEPS = [
  {
    key: 'welcome',
    icon: Crown,
    eyebrow: 'Membership unlocked',
    title: 'Welcome to Naka Labs MAX',
    body: 'You hold the highest tier on the platform. Every tool, every signal, every edge — unlocked, with no limits.',
  },
  {
    key: 'access',
    icon: Sparkles,
    eyebrow: 'Everything, unlocked',
    title: 'All access — nothing held back',
    body: 'Copy-trading, the sniper, whale tracker, smart-money intelligence, advanced orders, unlimited VTX AI, elite holder analysis and real-time data are all on.',
  },
  {
    key: 'badge',
    icon: ShieldCheck,
    eyebrow: 'Your mark',
    title: 'The gold MAX badge is yours',
    body: 'Your profile now carries the gold Naka MAX badge across the platform — a permanent mark of top-tier membership.',
  },
] as const;

const MAX_FEATURES = [
  'Copy-trading & auto-exit',
  'Sniper + security enrichment',
  'Whale tracker & smart money',
  'Unlimited VTX AI',
  'Elite holder analysis',
  'Real-time data & alerts',
];

export function MaxWelcomeJourney() {
  const [show, setShow] = useState(false);
  const [founder, setFounder] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/tier', { cache: 'no-store' });
        if (!res.ok) return;
        const t: TierInfo = await res.json();
        if (cancelled) return;
        // First-time Max unlock only: isMax true AND never welcomed before.
        if (t.isMax && !t.maxWelcomedAt) {
          setFounder(t.tierSource === 'founder_pass_nft');
          setShow(true);
        }
      } catch {
        /* tier probe failed — never block the dashboard on the welcome */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const finish = useCallback(async () => {
    setShow(false);
    try {
      await fetch('/api/user/max-welcomed', { method: 'POST' });
    } catch {
      /* best-effort: the flag is also set lazily on the next tier read paths */
    }
  }, []);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) { void finish(); return; }
    setDir(1);
    setStep((s) => s + 1);
  }, [step, finish]);

  const back = useCallback(() => {
    if (step === 0) return;
    setDir(-1);
    setStep((s) => s - 1);
  }, [step]);

  if (!show) return null;

  const s = STEPS[step];
  const StepIcon = s.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Naka Labs Max"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-[#04060f]/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => void finish()}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-[#FFD86B]/30 bg-gradient-to-b from-[#0c1024] to-[#070a16] p-7 shadow-2xl"
        style={{ boxShadow: '0 30px 80px -20px rgba(250,204,21,0.25), 0 0 0 1px rgba(255,216,107,0.08)' }}
      >
        {/* Gold radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.22), transparent 70%)' }}
        />

        {/* Skip / close */}
        <button
          type="button"
          onClick={() => void finish()}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white"
          aria-label="Skip welcome"
        >
          <X size={18} />
        </button>

        {/* Big gold badge reveal */}
        <div className="relative mb-5 flex justify-center">
          <motion.div
            initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}
            className="relative"
          >
            <img
              src="/branding/badge-max.png"
              alt="Naka Labs Max badge"
              width={84}
              height={84}
              style={{
                width: 84, height: 84, borderRadius: '50%', objectFit: 'cover',
                outline: '2px solid rgba(255,216,107,0.9)', outlineOffset: 2,
                filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.55))',
              }}
            />
          </motion.div>
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={s.key}
            custom={dir}
            initial={{ opacity: 0, x: dir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -28 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFD86B]/30 bg-[#FFD86B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FBBF24]">
              <StepIcon size={12} /> {s.eyebrow}
            </span>
            <h2 className="mt-4 text-[22px] font-bold leading-tight text-white">{s.title}</h2>
            <p className="mt-2.5 text-[14px] leading-relaxed text-[#C8D6FF]">{s.body}</p>

            {s.key === 'access' && (
              <ul className="mx-auto mt-4 grid max-w-[360px] grid-cols-2 gap-2 text-left">
                {MAX_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-[12px] text-[#9FB0D8]">
                    <Check size={13} className="shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {s.key === 'badge' && founder && (
              <p className="mt-3 text-[12px] text-[#9FB0D8]">
                Granted by your <span className="font-semibold text-[#FBBF24]">Founder Pass</span> — held on-chain, recognised automatically.
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((st, i) => (
            <span
              key={st.key}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[#FBBF24]' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="mt-5 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/60 transition hover:text-white"
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void finish()}
              className="rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/50 transition hover:text-white"
            >
              Skip
            </button>
          )}

          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFD86B] to-[#F59E0B] px-5 py-2.5 text-[14px] font-bold text-[#1a1206] shadow-lg transition hover:brightness-110"
          >
            {isLast ? 'Enter the platform' : 'Next'}
            <ArrowRight size={15} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
