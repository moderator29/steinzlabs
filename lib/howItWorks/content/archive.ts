import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const archiveHowItWorks: HowItWorksContent = {
  title: 'Archive',
  tagline: 'A searchable history of Context Feed events once they age past the live window.',
  howItWorks: [
    'The Archive holds on-chain and market events that have aged out of the live Context Feed, surfacing the persisted older window so signals stay reviewable instead of scrolling away.',
    'Events render as the same cards you see in the live feed, covering new listings, token launches, trending moves, whale accumulation and selling, large transfers, and trades.',
    'Results are sorted newest first and load in pages, so you can scan recent history quickly and pull in more as you go.',
    'Everything is filtered on the chain you select, spanning Ethereum, Solana, Base, BSC, Polygon, and Arbitrum.',
  ],
  howToUse: [
    'Open Archive from the dashboard to load the persisted history of older feed events.',
    'Pick a chain pill to focus on Ethereum, Solana, Base, BSC, Polygon, or Arbitrum.',
    'Use the type pills to narrow to News, Coins, New, Trending, or Volume activity.',
    'Type a token, title, or summary into the search box to find a specific event.',
    'Tap Load more to pull in additional results beyond the first page.',
  ],
  why: [
    'Markets move fast and signals scroll past, so a durable record lets you revisit what happened after the moment has passed.',
    'Filtering by chain, type, and keyword turns a long history into a focused view for research and pattern spotting.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Context Feed hardening improved the shared event pipeline that the Archive reads from, including chain-correct smart-money labeling for Solana.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'The Archive keeps older feed events searchable by chain, type, and keyword with the same cards as the live feed.',
    },
  ],
};
