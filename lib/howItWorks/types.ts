/**
 * Shared types for the in-app "How it works" panels.
 *
 * Every feature in the side navigation and the bottom menu ships a small
 * "How it works" button. Clicking it opens a branded glass panel that explains
 * the feature in three plain sections (How it works, How to use it, Why it
 * matters) plus a feature-scoped "What's new" log.
 *
 * Content rules (enforced by review, not by types):
 *   - No long dashes anywhere in user-facing copy. Use commas, colons, or
 *     middots instead.
 *   - No invented names, numbers, wallets, or fake dates. Everything must be
 *     grounded in how the feature actually works and in the real changelog.
 *   - Never describe admin-only or team-only internals. Explain only what a
 *     normal user sees and does.
 */

export type WhatsNewTag = 'NEW' | 'IMPROVED' | 'FIXED';

export interface WhatsNewEntry {
  /** Human period label, e.g. "June 2026". Keep it grounded in the changelog. */
  date: string;
  /** The kind of change, rendered as a small colored pill. */
  tag: WhatsNewTag;
  /** One short, dash-free sentence describing the change. */
  text: string;
}

export interface HowItWorksContent {
  /** Feature name, shown as the panel title. */
  title: string;
  /** One dash-free sentence that frames the feature. */
  tagline: string;
  /** What the feature does and how it produces its results. */
  howItWorks: string[];
  /** The ordered steps a user takes to get value from it. */
  howToUse: string[];
  /** The payoff: why this matters and when to reach for it. */
  why: string[];
  /** Recent, real changes. Most recent first. */
  whatsNew: WhatsNewEntry[];
}
