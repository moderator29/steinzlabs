import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const smartMoneyHowItWorks: HowItWorksContent = {
  title: 'Smart Money',
  tagline: 'Track the high-volume on-chain wallets that move first, ranked by the size of their flow.',
  howItWorks: [
    'The leaderboard is built from live on-chain data: large transfers pulled from Alchemy and high-volume trading pairs pulled from DexScreener across Ethereum, Solana, BSC, and Base.',
    'Wallets are ranked by trading volume and recent activity, then tagged with a behavior archetype such as Diamond Hands, Scalper, Holder, or Whale Follower so you can read their style at a glance.',
    'A convergence signal fires when two or more tracked wallets buy the same token within the day, and a Weekly Risers panel surfaces the strongest recent movers.',
    'The leaderboard refreshes itself about once a minute, and each new convergence signal raises an in-app notification so you do not have to keep the page open.',
  ],
  howToUse: [
    'Open the Leaderboard tab to see the top wallets, with headline stats for wallets tracked and total volume across them.',
    'Sort by rank, win rate, PnL, volume, or trades, then search by wallet name, address, or tag to narrow the list.',
    'Tap a wallet to expand its recent activity, average hold, and best trade, then use the watch control to keep an eye on it.',
    'Tap Paper Trade on any wallet to simulate copying its strategy with virtual capital and no real funds at risk.',
    'Tap Analyze to open full Wallet Intelligence on that address for a deeper breakdown.',
  ],
  why: [
    'Following large on-chain wallets lets you spot accumulation and rotation early, often before a move shows up in price.',
    'Archetypes and convergence signals turn raw transfer noise into a clear read on where conviction is building.',
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
