'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'naka_vault_entered';

interface Props {
  /** When true, plays the abbreviated 0.6s entry. Defaults to once-per-session check via localStorage. */
  abbreviated?: boolean;
  onComplete?: () => void;
}

/**
 * Vault entry cinematic.
 *
 * Sequence (3s first visit, 0.6s subsequent):
 *   ┌─ darken ─ sigil materialise ─ rotate ─ pulse ─ split open ─ chamber reveal
 *
 * Click anywhere to skip. Subsequent visits this session use the
 * abbreviated form (just the seal pulse + door split). Persists "seen"
 * in localStorage so revisiting the Vault on a new tab still reads as
 * "returning member" — the first-time epic only fires once per device.
 *
 * Pure CSS + Framer Motion. No external animation deps. Respects
 * prefers-reduced-motion: a single fade replaces the entire sequence.
 */
export function VaultEntryAnimation({ abbreviated, onComplete }: Props) {
  const [phase, setPhase] = useState<'init' | 'seal' | 'open' | 'done'>('init');
  const [skipMode, setSkipMode] = useState<'full' | 'short'>('full');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = abbreviated ?? localStorage.getItem(STORAGE_KEY) === 'true';
    if (reduced) {
      // Reduced motion: no cinematic at all, just resolve instantly.
      setPhase('done');
      onComplete?.();
      return;
    }
    setSkipMode(seen ? 'short' : 'full');
    const fullDelays = { seal: 600, open: 1900, done: 2800 };
    const shortDelays = { seal: 100, open: 400, done: 700 };
    const d = seen ? shortDelays : fullDelays;

    const t1 = setTimeout(() => setPhase('seal'), d.seal);
    const t2 = setTimeout(() => setPhase('open'), d.open);
    const t3 = setTimeout(() => {
      setPhase('done');
      try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
      onComplete?.();
    }, d.done);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [abbreviated, onComplete]);

  if (phase === 'done') return null;

  const skip = () => {
    setPhase('done');
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    onComplete?.();
  };

  return (
    <AnimatePresence>
      <motion.button
        key="vault-entry"
        type="button"
        onClick={skip}
        aria-label="Skip vault entry animation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.4 } }}
        className="vault-entry"
      >
        {/* Two halves of the door — slide outwards on phase 'open' */}
        <motion.div
          className="vault-entry__door vault-entry__door--left"
          initial={{ x: 0 }}
          animate={{ x: phase === 'open' ? '-100%' : 0 }}
          transition={{ duration: skipMode === 'full' ? 0.9 : 0.3, ease: [0.65, 0, 0.35, 1] }}
        />
        <motion.div
          className="vault-entry__door vault-entry__door--right"
          initial={{ x: 0 }}
          animate={{ x: phase === 'open' ? '100%' : 0 }}
          transition={{ duration: skipMode === 'full' ? 0.9 : 0.3, ease: [0.65, 0, 0.35, 1] }}
        />

        {/* Naka sigil — materialises, rotates, then pulses on 'seal' */}
        <motion.div
          className="vault-entry__sigil"
          initial={{ opacity: 0, scale: 0.6, rotate: -120 }}
          animate={{
            opacity: phase === 'init' ? 0.4 : 1,
            scale: phase === 'seal' ? 1.1 : 1,
            rotate: 0,
          }}
          transition={{
            opacity: { duration: 0.6 },
            scale: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
            rotate: { duration: skipMode === 'full' ? 1.4 : 0.4, ease: [0.22, 1, 0.36, 1] },
          }}
        >
          <span className="vault-entry__sigil-glyph">◈</span>
        </motion.div>

        {phase === 'seal' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 0], scale: [0.8, 1.5, 2] }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="vault-entry__pulse"
          />
        )}

        <span className="vault-entry__hint">Click to skip</span>
      </motion.button>
    </AnimatePresence>
  );
}
