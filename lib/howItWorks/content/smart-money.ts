import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const smartMoneyHowItWorks: HowItWorksContent = {
  title: 'Smart Money',
  tagline: 'Track the high-volume on-chain wallets that move first, ranked by the size of their flow.',
  howItWorks: [
    'Smart Money assembles a live leaderboard of the largest, most active on-chain participants so you can watch where serious capital is going before it shows up cleanly in price.',
    'The wallet feed is built from real data: Alchemy supplies recent large Ethereum transfers, which are grouped by sender into wallet profiles and ranked by volume, while DexScreener supplies the highest-volume trading pairs across Ethereum, Solana, BSC, and Base so the board stays multi-chain.',
    'Each wallet is given a behavior archetype, computed from its activity such as trade count and hold pattern, including Diamond Hands, Scalper, Degen, Whale Follower, Holder, New Wallet, and Inactive, so you can read its style without studying every transaction.',
    'A convergence signal fires when two or more tracked wallets buy the same token in the window, surfacing in a banner with the symbol, the number of wallets, and the combined volume, and the Weekly Risers panel highlights the strongest recent movers by weekly change.',
    'The Top Performers cards spotlight the leading wallets by win rate, the Recent Moves rail streams the latest buys, sells, and swaps with token, size, and chain, and known exchange addresses such as Binance and Coinbase deposits are labeled so routine custodial flow is easy to recognize.',
    'The leaderboard refreshes itself about once a minute with a live timestamp, and every new convergence signal raises an in-app notification so you do not need to keep the page open to catch a fresh cluster.',
  ],
  howToUse: [
    'Open the Leaderboard tab to see ranked wallets along with the headline stats for total wallets tracked, combined volume across them, and average win rate.',
    'Scan the Convergence banner and Weekly Risers panel first, since they point to where multiple wallets are aligning or which names are accelerating this week.',
    'Use the sort controls to order the board by rank, win rate, PnL percent, volume, or trades, then type into the search box to filter by wallet name, address, or tag.',
    'Tap any wallet to expand its recent activity, average hold, and best trade, then use the watch control to pin it; your watch list is saved on this device and powers the watching-only view.',
    'Tap Paper Trade on a wallet to model copying its strategy with simulated capital of one hundred, five hundred, or one thousand and see an estimated outcome, with no real funds ever placed.',
    'Tap Analyze on an expanded wallet to open full Wallet Intelligence on that address for a deeper, chain-aware breakdown.',
    'Switch to the History tab to review the running stream of recent smart money moves, and use the Settings tab to tune which alerts and on-board signals you want surfaced.',
  ],
  why: [
    'Following the largest on-chain wallets lets you spot accumulation and rotation early, often while a move is still building and before it resolves into an obvious price trend.',
    'Archetypes and convergence signals turn a flood of raw transfers into a readable view of where conviction is forming, which is exactly what you want when scanning for the next setup.',
    'Reach for it when you are sizing up a token or a sector and want confirmation that real money agrees, or when you are hunting for fresh ideas at the start of a research session.',
    'Paper trading lets you pressure-test a copy strategy and build confidence on a wallet before committing any capital of your own.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Added convergence signals, archetype badges, and a Weekly Risers panel so the board reads as conviction rather than raw transfers.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The DexScreener pair feed stopped fabricating a fifty-fifty buy and sell split when transaction data is missing, so Recent Moves reflect real flow.',
    },
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'Smart money wallet labeling is now chain-correct, so Solana wallets are labeled properly alongside Ethereum.',
    },
  ],
};
