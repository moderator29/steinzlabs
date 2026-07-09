import type { WhatsNewEntry } from '@/lib/howItWorks/types';

/**
 * Platform-wide "What's new" log shown from the side navigation. Most recent
 * first. Entries are grounded in the real changelog and describe only what a
 * normal user can see and do. Keep copy free of dash punctuation.
 */
export const GLOBAL_WHATS_NEW: WhatsNewEntry[] = [
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Safer trading: Swap now blocks known honeypot and high risk tokens before you sign, and refuses trades from sanctioned wallets, so a dangerous token cannot be bought by mistake.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Stronger wallet security: your sniper signing key is now encrypted on your device instead of stored in the clear, and sign in no longer keeps a copy of your session token in the browser.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'Portfolio and wallet balances now value every token correctly, including stablecoins and wrapped coins, so your total net worth reads true.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'Copy trading and sniper now record each trade exactly once, so your realized profit and loss and win rate are accurate.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Real data only: trending, holder counts, token cards and charts now show live figures or an honest blank, never a placeholder or filler value.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Mobile polish: trade and wallet pop ups now fit the screen so the confirm button is always in reach, even with the keyboard open.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Account hardening across sign in, profiles, alerts and admin tools to keep your account and your data safe.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Live token terminal: every coin now opens a real time stats panel (price, liquidity, FDV, market cap, buys and sells) that refreshes every few seconds from live DEX data.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Market search now finds any of thousands of coins by name, symbol, or contract address, with accurate live data.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'AI Scanner runs deeper multi source security checks (honeypot, taxes, mint authority, liquidity locks, holder concentration) and shows exactly why it rated a token.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'VTX Agent no longer stalls on some tokens and now sources coin data live from DEX pairs, so its numbers match the price cards across the app.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Whale Tracker now leads with the biggest wallets by real held portfolio value.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Portfolio and Wallet now show a real combined balance across every chain, and long tail tokens price correctly instead of reading zero.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'Swap now shows a real price impact and network fee instead of a flat zero.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Tightened account security so nothing from one account can appear after signing into another on a shared device.',
  },
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
