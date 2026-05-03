/**
 * Framer Motion presets for the cinematic layer. Centralized so every
 * surface uses the same easing curves and durations — keeps motion
 * coherent without copy-pasting variant objects across components.
 */
import type { Variants, Transition } from 'framer-motion';

export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  spring: { type: 'spring', stiffness: 200, damping: 22 } as Transition,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE.out } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: EASE.out } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE.out } },
};

export const stagger = (delay = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

export const orbBurst: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: EASE.spring },
};

export const portalEnter: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE.out } },
  hover:   { scale: 1.05, transition: { duration: 0.3, ease: EASE.out } },
};

export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: EASE.out } },
  exit:    { opacity: 0, transition: { duration: 0.2, ease: EASE.out } },
};
