import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const researchHowItWorks: HowItWorksContent = {
  title: 'Research Lab',
  tagline: 'A live feed of crypto research briefs and market reads, refreshed for you automatically.',
  howItWorks: [
    'Research Lab gathers published briefs and market intel into one clean reading feed, with each post tagged by the source it came from, such as CoinGecko, DexScreener, or CryptoPanic.',
    'A daily market brief assembles a real read of the market each day, covering top gainers and losers, overall market mood, trending searches, and the biggest priced whale moves from the last 24 hours.',
    'Every post is tagged by category and source, so you can tell at a glance whether you are reading about DeFi, Layer2, security, on-chain flows, or broad market analysis.',
    'The feed refreshes on its own every few minutes, and each card shows how recently the data was updated alongside an estimated read time.',
  ],
  howToUse: [
    'Open Research Lab to see the latest briefs, with the freshest piece featured at the top.',
    'Type in the search box to find posts by title, summary, or tag.',
    'Tap a category tab, or open Filters to sort by Latest or Trending and narrow by topic.',
    'Tap any card to read the full brief, then use View Source to open the original where available.',
    'Tap the refresh control any time you want the newest posts immediately.',
  ],
  why: [
    'It puts vetted market intel and a daily market read in one place, so you spend less time hunting across sites and more time acting on signal.',
    'Live sourcing and automatic refresh mean the briefs reflect current conditions, not stale snapshots.',
    'Clear categories and source tags let you trust where each read comes from and focus on the topics that matter to you.',
  ],
  whatsNew: [
    { date: 'June 2026', tag: 'NEW', text: 'A new automated daily market brief publishes a real read of the market each day, built from live CoinGecko data and the platform whale activity feed.' },
    { date: 'June 2026', tag: 'IMPROVED', text: 'Full brief detail pages now render each post with its cover, category, read time, and a live view counter.' },
  ],
};
