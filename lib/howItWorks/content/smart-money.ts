import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const smartMoneyHowItWorks: HowItWorksContent = {
  title: 'Smart Money',
  tagline: 'Track the on-chain wallets that move first, ranked by how they actually trade.',
  howItWorks: [
    'The leaderboard is built from live on-chain data: large transfers surfaced from Alchemy and high-volume trading pairs from DexScreener across Ethereum, Solana, BSC, and Base.',
    'Each wallet is ranked by real volume, win rate, and recent performance, then tagged with a behavior archetype like Diamond Hands, Scalper, Holder, or Whale Follower so you can read its style at a glance.',
    'A convergence signal fires when several tracked wallets buy the same token in a short window, and weekly risers highlight the wallets whose recent performance is climbing fastest.',
    'The feed refreshes itself about once a minute, and new convergence signals raise an in-app notification so you do not have to keep the page open.',
  ],
  howToUse: [
    'Open the Leaderboard tab to see the top wallets, with stats for total volume, average win rate, and the count of wallets being tracked.',
    'Sort by rank, win rate, PnL, volume, or trades, then search by wallet name, address, or tag to narrow the list.',
    'Tap a wallet to expand its recent activity, average hold, and best trade, then use the watch control to keep an eye on it.',
    'Tap Paper Trade on any wallet to simulate copying its strategy with virtual capital, with no real funds at risk.',
    'Tap Analyze to open full Wallet Intelligence on that address for a deeper breakdown.',
  ],
  why: [
    'Following proven on-chain wallets lets you spot accumulation and rotation early, often before a move shows up in price.',
    'Archetypes and convergence signals turn raw transfer noise into a clear read on conviction, so you know which activity is worth acting on.',
    'Paper trading lets you test a copy strategy and build confidence before committing any capital.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'Smart-money wallet labeling is now chain-correct, so Solana wallets are labeled properly alongside Ethereum.',
    },
  ],
};
