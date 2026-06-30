import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const transactionsHowItWorks: HowItWorksContent = {
  title: 'Transactions',
  tagline: 'Your unified swap and snipe history across every supported chain, in one place.',
  howItWorks: [
    'Transactions pulls your real on-chain activity from two ledgers: the swaps you have executed and the snipes the sniper has filled for your account.',
    'Each entry shows what moved (token pair for a swap, the token bought for a snipe), the chain it ran on, its status, and how long ago it happened, sorted with the newest first.',
    'Status reflects the real outcome on chain: confirmed, pending, or failed. An unknown or missing state is shown as pending rather than assumed successful.',
    'When a transaction has an on-chain hash, the entry links straight to the matching block explorer for Ethereum, Base, Arbitrum, Polygon, BSC, or Solana.',
  ],
  howToUse: [
    'Open Transactions from the dashboard to load your most recent swaps and snipes.',
    'Use the All, Swaps, or Snipes filter at the top to focus on one kind of activity.',
    'Read each row for the token movement, chain, status, value, and time since it happened.',
    'Tap the external link on any confirmed entry to open the full transaction on its block explorer.',
    'Hit Refresh to pull the latest activity after a new trade settles.',
  ],
  why: [
    'One honest record of everything you have traded and sniped, instead of jumping between wallets and explorers.',
    'Clear status and explorer links let you confirm exactly what settled on chain and what is still pending.',
    'Multi-chain coverage keeps your full trading footprint visible from a single view.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Transactions brings your swap and snipe history together with live status and direct block explorer links across all six supported chains.',
    },
  ],
};
