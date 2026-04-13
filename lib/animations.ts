/**
 * Steinz Labs — Framer Motion Animation Presets
 *
 * Consistent animation tokens for use across the platform.
 * Import the variant group you need and spread it onto motion components.
 */

import type { Variants, Transition } from 'framer-motion';

// ─── Transitions ──────────────────────────────────────────────────────────────

export const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' } satisfies Transition,
  default: { duration: 0.25, ease: 'easeOut' } satisfies Transition,
  slow: { duration: 0.4, ease: 'easeOut' } satisfies Transition,
  spring: { type: 'spring', stiffness: 400, damping: 30 } satisfies Transition,
  springLight: { type: 'spring', stiffness: 200, damping: 25 } satisfies Transition,
  bounce: { type: 'spring', stiffness: 500, damping: 20 } satisfies Transition,
} as const;

// ─── Fade ─────────────────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.default },
  exit: { opacity: 0, transition: transitions.fast },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: transitions.default },
  exit: { opacity: 0, y: 10, transition: transitions.fast },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: transitions.default },
  exit: { opacity: 0, y: -10, transition: transitions.fast },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: transitions.default },
  exit: { opacity: 0, x: -10, transition: transitions.fast },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: transitions.default },
  exit: { opacity: 0, x: 10, transition: transitions.fast },
};

// ─── Scale ────────────────────────────────────────────────────────────────────

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: transitions.spring },
  exit: { opacity: 0, scale: 0.95, transition: transitions.fast },
};

export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: transitions.springLight },
  exit: { opacity: 0, scale: 0.9, transition: transitions.fast },
};

// ─── Slide ────────────────────────────────────────────────────────────────────

export const slideUp: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: transitions.spring },
  exit: { y: '100%', opacity: 0, transition: transitions.default },
};

export const slideDown: Variants = {
  hidden: { y: '-100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: transitions.spring },
  exit: { y: '-100%', opacity: 0, transition: transitions.default },
};

export const slideLeft: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: transitions.spring },
  exit: { x: '100%', opacity: 0, transition: transitions.default },
};

export const slideRight: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: transitions.spring },
  exit: { x: '-100%', opacity: 0, transition: transitions.default },
};

// ─── Stagger containers ───────────────────────────────────────────────────────

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transitions.default },
};

// ─── Card hover ───────────────────────────────────────────────────────────────

export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.015,
    y: -2,
    transition: transitions.fast,
  },
};

export const buttonHover = {
  rest: { scale: 1 },
  hover: {
    scale: 1.03,
    transition: transitions.fast,
  },
  tap: {
    scale: 0.97,
    transition: transitions.fast,
  },
};

// ─── Page transitions ─────────────────────────────────────────────────────────

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// ─── Pulse / glow effect (for live indicators) ────────────────────────────────

export const pulse: Variants = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.1, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const glowPulse: Variants = {
  initial: { boxShadow: '0 0 0 0 rgba(10, 30, 255, 0)' },
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(10, 30, 255, 0)',
      '0 0 20px 4px rgba(10, 30, 255, 0.3)',
      '0 0 0 0 rgba(10, 30, 255, 0)',
    ],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ─── Number counter animation ──────────────────────────────────────────────────

export const counterConfig = {
  duration: 1.5,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

// ─── Floating animation (for landing coins / decorative elements) ──────────────

export function floatingVariant(delay = 0, amplitude = 12): Variants {
  return {
    initial: { y: 0 },
    animate: {
      y: [-amplitude / 2, amplitude / 2, -amplitude / 2],
      transition: {
        duration: 4 + delay * 0.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      },
    },
  };
}

// ─── Reveal on scroll (use with useInView) ────────────────────────────────────

export const revealOnScroll: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};
