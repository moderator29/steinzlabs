'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  href: string;
  name: string;
  tagline: string;
  description: string;
  sigil: ReactNode;
  /** Lock badge · shown when the chamber isn't built yet ("Coming soon"). */
  comingSoon?: boolean;
}

/**
 * One of three Vault chamber portals. Renders the cult-themed glass card
 * with sigil, name, tagline, description, and a "Enter →" CTA. Clicking
 * navigates to the chamber's route.
 *
 * Animation: enters with fade-up via Framer Motion, breathes subtly while
 * idle (CSS animation), and lifts on hover. Respects prefers-reduced-motion
 * via the underlying CSS.
 */
export function ChamberPortal({ href, name, tagline, description, sigil, comingSoon }: Props) {
  // A11Y3: respect prefers-reduced-motion by skipping the fade-up entry
  // and the hover lift. The CSS-driven idle "breathe" continues to honor
  // the same media query at the stylesheet level.
  const reduced = useReducedMotion();
  const inner = (
    <motion.div
      // §nakacult-scroll-bug: was `whileInView` with `viewport={{ once: true }}`,
      // which combined with the page's layout shifts caused the
      // IntersectionObserver to re-fire after every reflow and yanked the
      // page back to its previous scroll position. Swapped to a mount-time
      // `initial → animate` (runs once when the card mounts; never re-fires
      // on scroll), so the page no longer auto-scrolls while user is reading.
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduced ? undefined : { y: -4 }}
      className="vault-portal group"
    >
      <div className="vault-portal__sigil">{sigil}</div>
      <div className="vault-portal__title">
        <span className="vault-portal__name">{name}</span>
        <span className="vault-portal__tagline">{tagline}</span>
      </div>
      <p className="vault-portal__desc">{description}</p>
      <span className="vault-portal__cta">
        {comingSoon ? 'Coming soon' : 'Enter'}
        {!comingSoon && <ArrowRight size={16} />}
      </span>
    </motion.div>
  );

  if (comingSoon) {
    return <div aria-disabled="true" className="cursor-not-allowed">{inner}</div>;
  }
  return (
    <Link href={href} className="block focus-visible:outline-none">
      {inner}
    </Link>
  );
}
