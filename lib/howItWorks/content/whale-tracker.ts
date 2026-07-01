import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const whaleTrackerHowItWorks: HowItWorksContent = {
  title: 'Whale Tracker',
  tagline: 'Watch the largest wallets move, priced and labeled in real time.',
  howItWorks: [
    'Whale Tracker follows large wallets across Ethereum, Solana, Base, Arbitrum, and BSC and brings their buys, sells, and transfers into one place so you can read where serious money is flowing.',
    'The Live Feed opens on a Traders view that ranks the most active wallets by their seven day DEX volume from the whale directory, and a second Activity view streams the raw move by move tape from the whale_activity table so you can choose between a ranked shortlist and a chronological flow.',
    'Every move is priced in US dollars the moment it is ingested using CoinGecko and Birdeye market data, which is why the size filters reflect real value rather than raw token counts and why a fresh row already shows a dollar figure.',
    'Each wallet carries an entity label such as Smart Money, CEX, Market Maker, Bot, Insider, or Bridge, resolved from a curated registry of known on-chain addresses and from the entity type stored on the wallet, so an opaque address reads as an identity at a glance.',
    'Strong performers also pick up behavioral badges, Accumulator, Distributor, Sniper, and a high win rate marker, derived from thirty day realized profit, win rate, and average hold time so you can judge a wallet on its track record, not just its latest trade.',
    'The right rail surfaces My Whales for the wallets you follow, Top Whales Today ranked by twenty four hour volume, and a PnL Leaderboard ranked by thirty day realized profit, while the feed itself updates the instant new activity lands and lights a refresh pill so you can pull fresh moves in without losing your place.',
  ],
  howToUse: [
    'Open the Live Feed and stay on the Traders view for a ranked shortlist of active wallets, or switch to the Activity view when you want the full chronological tape.',
    'Pick the chains you care about with the chain pills, then tighten the flow with the size, time range, and action filters to focus on, for example, buys above 100k in the last hour.',
    'In the Activity view, toggle the label pills to keep only Smart Money, CEX, Market Maker, Bot, Insider, or Bridge wallets, and type a token symbol in the search box to track flow into a specific name.',
    'Tap any wallet to open its profile and study its history, win rate, holding behavior, and recent moves before you act on it.',
    'On an actionable buy or sell row, use the copy control to carry that exact trade into the copy trading confirm flow, where the tier, safety, and size checks run before anything reaches your wallet.',
    'Add a wallet to My Whales, set a dollar threshold, and choose in-app, Telegram, or email alerts so you are notified the next time it makes a qualifying move.',
    'Lean on Top Whales Today and the PnL Leaderboard in the side rail to find new wallets worth following, and star any of them straight from the list.',
  ],
  why: [
    'Whales often move before the crowd, so seeing their flow live priced and labeled gives you an early read on where momentum and conviction are building.',
    'Dollar based sizing, entity labels, and behavioral badges cut the noise, so your attention goes to proven wallets and the moves that actually matter rather than every small transfer.',
    'Reach for it when you want to validate a thesis, find fresh wallets to study, or shadow a trader you trust, and it slots in next to copy trading so a promising move becomes an action in a couple of taps.',
    'Alerts mean you do not have to watch the screen, because the platform tells you when a wallet you follow crosses your threshold and you can decide from there.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'The feed now opens on a ranked Traders view alongside the raw activity tape, with a PnL Leaderboard and behavioral badges so you can spot Accumulator, Distributor, Sniper, and high win rate wallets at a glance.',
    },
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'Whale ingestion now rotates through every active wallet, captures both the received and sent side of each move, and prices every row in dollars at ingest so the size filters work again.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Following a wallet now sends a durable in-app notification and an email when it crosses your dollar threshold, and the new activity pill lights within a second of a move landing.',
    },
  ],
};
