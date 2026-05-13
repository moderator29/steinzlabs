'use client';
import { motion } from 'framer-motion';
import { DailySeal } from './DailySeal';
import { VtxSagePanel } from './VtxSagePanel';
import { WhisperNetworkPanel } from './WhisperNetworkPanel';
import { ChosenSealDraftPanel } from './ChosenSealDraftPanel';

/**
 * Oracle hub — the chamber's landing surface.
 *
 * Headline: the Daily Seal (fully wired).
 * Below: three styled placeholder cards for the remaining sub-features
 * (VTX Sage, Whisper Network, Echo Chamber). Placeholders use the same
 * vault-portal styling as the chamber portals on /vault so the chamber
 * looks populated even before each sub-feature ships in its own branch.
 */
export function OracleHubClient() {
  return (
    <section className="oracle-chamber mx-auto max-w-5xl px-5 pb-16">
      <header className="oracle-chamber__header">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#00C8FF] mb-2">The Sight Chamber</p>
        <h1 className="cinematic-heading text-3xl">The Oracle</h1>
        <p className="text-[14px] text-[#B4C0E0] max-w-2xl mt-2">
          The seal of dawn, the sage, the whispers, the echoes. Knowledge moves through the cult before it reaches the noise.
        </p>
      </header>

      <div className="oracle-chamber__grid">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="oracle-chamber__seal-slot"
        >
          <DailySeal />
        </motion.div>

        <ChosenSealDraftPanel />

        <VtxSagePanel />
        <WhisperNetworkPanel />
        <SubChamberPlaceholder
          title="Echo Chamber"
          tagline="Stealth wallet tracking. 25-slot quiet pack — only the cult sees what they hold."
          eta="Next pass"
        />
      </div>
    </section>
  );
}

function SubChamberPlaceholder({ title, tagline, eta }: { title: string; tagline: string; eta: string }) {
  return (
    <article className="oracle-subchamber" aria-label={`${title} — ${eta}`}>
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">Sub-chamber</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#FFD86B]">{eta}</span>
      </header>
      <h3 className="oracle-subchamber__title">{title}</h3>
      <p className="oracle-subchamber__tagline">{tagline}</p>
      <div className="oracle-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
