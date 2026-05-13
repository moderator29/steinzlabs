'use client';
import { motion } from 'framer-motion';
import { LibraryPlayer } from './LibraryPlayer';
import { MantlePanel } from './MantlePanel';

/**
 * Sanctum hub — the chamber's landing surface.
 *
 * Headline: the Library (Ddergo Sanctuary, fully wired via Spotify embed).
 * Below: three styled placeholder cards for the remaining sub-features
 * (the Mantle, the Annals, the Forge). Same pattern as the Oracle hub.
 */
export function SanctumHubClient() {
  return (
    <section className="sanctum-chamber mx-auto max-w-5xl px-5 pb-16">
      <header className="sanctum-chamber__header">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFD86B] mb-2">The Soul Chamber</p>
        <h1 className="cinematic-heading text-3xl">The Sanctum</h1>
        <p className="text-[14px] text-[#B4C0E0] max-w-2xl mt-2">
          The Mantle to wear, the Annals to write into, the Library to listen, the Forge to display. Identity is a ritual.
        </p>
      </header>

      <div className="sanctum-chamber__grid">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="sanctum-chamber__library-slot"
        >
          <LibraryPlayer />
        </motion.div>

        <MantlePanel />
        <SubChamberPlaceholder
          title="The Annals"
          tagline="Achievements forged into the record. Bronze, silver, gold, mythic."
          eta="Next pass"
        />
        <SubChamberPlaceholder
          title="The Forge"
          tagline="The sigils you hold, displayed. Auto-detected NFTs, 3D rotation."
          eta="Next pass"
        />
      </div>
    </section>
  );
}

function SubChamberPlaceholder({ title, tagline, eta }: { title: string; tagline: string; eta: string }) {
  return (
    <article className="sanctum-subchamber" aria-label={`${title} — ${eta}`}>
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">Sub-chamber</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#FFD86B]">{eta}</span>
      </header>
      <h3 className="sanctum-subchamber__title">{title}</h3>
      <p className="sanctum-subchamber__tagline">{tagline}</p>
      <div className="sanctum-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
