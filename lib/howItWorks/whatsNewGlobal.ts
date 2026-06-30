import type { WhatsNewEntry } from '@/lib/howItWorks/types';

/**
 * Platform-wide "What's new" log shown from the side navigation. Most recent
 * first. Entries are grounded in the real changelog and describe only what a
 * normal user can see and do. Keep copy free of dash punctuation.
 */
export const GLOBAL_WHATS_NEW: WhatsNewEntry[] = [
  {
    date: 'June 2026',
    tag: 'NEW',
    text: 'Daily Research Brief: an automated daily market read now lands in Research Labs and, if you want it, your inbox.',
  },
  {
    date: 'June 2026',
    tag: 'NEW',
    text: 'Whale Tracker streams a live, dollar-priced feed across every chain, covering both received and sent moves.',
  },
  {
    date: 'June 2026',
    tag: 'IMPROVED',
    text: 'Wallet Intelligence added best and worst realized trades, an activity heatmap, multi-chain net worth, and top counterparties.',
  },
  {
    date: 'June 2026',
    tag: 'IMPROVED',
    text: 'Research Labs now opens a full detail page for every brief, with cover, category, read time, and a live view count.',
  },
  {
    date: 'June 2026',
    tag: 'FIXED',
    text: 'Market and feed surfaces now report only real trade data and show an honest idle state when a tape is quiet.',
  },
  {
    date: 'June 2026',
    tag: 'IMPROVED',
    text: 'Direct messages and live feeds update in real time without a reload, and unread counts clear as soon as you read.',
  },
];
