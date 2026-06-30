import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const archiveHowItWorks: HowItWorksContent = {
  title: 'Archive',
  tagline: 'A searchable history of Context Feed events once they age past the live window.',
  howItWorks: [
    'The Archive is the historical half of the Context Feed, holding events that are roughly 24 to 72 hours old, so the signals that scrolled out of the live stream stay reviewable instead of disappearing.',
    'It reads from a persisted store of feed events rather than a single in-memory snapshot, which makes the history deterministic and complete every time you open it, regardless of which server instance answers the request.',
    'Those events are aggregated from the same real sources that power the live feed, including CoinGecko gainers and trending coins, DexScreener and GeckoTerminal pairs, Birdeye Solana volume, LunarCrush social velocity, GoPlus security scans for rug alerts, Alchemy Ethereum transfers, Solana network activity, and pump.fun launches.',
    'Each event renders as the exact same card you see in the live feed, with a sentiment badge, a chain badge, the source platform, the title and summary, a price and 24h change row, and a stats grid for 24h volume, liquidity, and market cap when that data exists.',
    'A Signal bar on every card reflects the source confidence behind that event and reads as STRONG, MEDIUM, or WEAK, while higher-value transfers earn an INTEL badge and high-confidence events earn a VERIFIED badge so the strongest history stands out at a glance.',
    'Some transfers are upgraded into labeled smart-money events when a counterparty matches the platform\'s curated whale wallets, so the card names the wallet and whether it was accumulating or distributing rather than showing a plain transfer.',
    'Every card carries a View Proof action that opens the underlying evidence for that event, so an archived signal stays fully inspectable long after the moment it fired.',
  ],
  howToUse: [
    'Open Archive from the dashboard to load the persisted history of feed events that have aged past the live 24 hour window.',
    'Pick a chain pill to focus the history on Ethereum, Solana, Base, BSC, Polygon, or Arbitrum, or leave it on All Chains for the full cross-chain view.',
    'Use the type pills to narrow to News, Coins, New, Trending, or Volume activity, which maps to listings, launches, trending moves, and whale or large-transfer flow.',
    'Type a token symbol, a title fragment, or a phrase from a summary into the search box to pull a specific event out of the history.',
    'Read each card from the badges down, checking the sentiment, the Signal strength, and the volume, liquidity, and market-cap stats to judge how meaningful the event was.',
    'Tap View Proof on any card to open its supporting evidence when you want to verify the signal before acting on it.',
    'Use Load more at the bottom to pull in the next page of results beyond the first batch, since events are sorted newest first.',
  ],
  why: [
    'Markets move fast and signals scroll past in seconds, so a durable, searchable record lets you revisit exactly what happened after the moment has passed.',
    'Filtering by chain, type, and keyword turns a long, noisy history into a focused view, which is ideal for confirming a thesis, spotting repeated patterns, or studying how an early signal played out.',
    'Because the archive reuses the live feed\'s cards, Signal scoring, and View Proof flow, the research you do here lines up one to one with what you watch in real time.',
    'Reach for it when you need to reconstruct a recent window of on-chain and market activity, audit a token\'s footprint, or build context before a trade rather than reacting blind.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Smart-money labeling in archived events is now chain-correct, so Solana whale wallets are matched and named alongside Ethereum ones instead of being silently skipped.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The Archive now returns the full 24 to 72 hour history from a persisted store, so older events stay complete and consistent every time you open it rather than reflecting a single server\'s partial view.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'The Archive keeps older feed events searchable by chain, type, and keyword, rendering each one with the same cards, Signal bar, and View Proof action as the live feed.',
    },
  ],
};
