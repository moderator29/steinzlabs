import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const researchHowItWorks: HowItWorksContent = {
  title: 'Research Lab',
  tagline: 'A live on-chain newsroom that pairs a daily market read with published research.',
  howItWorks: [
    'Research Lab is the platform reading room, leading with a full daily Market Brief and backing it with a searchable feed of published research posts.',
    'The Market Brief is an automated daily read assembled from CoinGecko, covering top gainers and losers among the largest tokens, the overall market mood, market breadth, benchmark majors, the most traded assets, and trending searches, combined with the platform whale activity feed to surface the biggest priced whale moves of the last 24 hours.',
    'Every figure in the brief is pulled live at publish time from real market data and the platform whale feed. Nothing is fabricated: when a data source is unavailable that section is simply left out rather than filled with a placeholder.',
    'The Latest Research feed pulls published briefs and analysis, each tagged by category such as DeFi, Layer2, Security, On-Chain, or Market Analysis and by the source it came from, including CoinGecko, DexScreener, and CryptoPanic, with an estimated read time on every card.',
    'The page leads with the freshest story flagged as Breaking, refreshes itself every five minutes, and shows how long ago the data last updated, so what you read reflects current conditions rather than a stale snapshot.',
  ],
  howToUse: [
    'Open Research Lab and start with the Market Brief at the top for the latest on-chain and market read.',
    'Use Read the full brief to expand the complete daily read inline, or Open in reader for the full-page view.',
    'Use the search box to find published posts by title, summary, or tag, and clear it any time to return to the full feed.',
    'Tap a category tab to focus on a topic, or open Filters to switch the sort between Latest and Trending and narrow by category from the panel.',
    'Tap any research card to read the full brief, then use View Source to open the original where a link is available.',
    'Hit the refresh control whenever you want the newest posts immediately, instead of waiting for the automatic five minute refresh.',
  ],
  why: [
    'It collapses several tabs into one workspace, putting a daily market read and vetted research side by side so you spend less time hunting across sites and more time acting on what matters.',
    'Reach for it at the start of a session to get oriented, or when you want context behind a token before you trade it.',
    'Live sourcing and named provenance on every item let you judge where each read comes from and how much weight to give it, instead of trusting an unattributed headline.',
    'It sits naturally upstream of the rest of the platform: read the market here, then move into the deeper analysis and execution tools with the context already in hand.',
  ],
  whatsNew: [
    { date: 'July 2026', tag: 'IMPROVED', text: 'The daily Market Brief now adds real market breadth, a benchmark majors board, and the most traded assets alongside the existing movers, whale moves, and trending sections, all built from live data.' },
    { date: 'June 2026', tag: 'NEW', text: 'An automated daily Market Brief publishes a real read of the market built from live CoinGecko data and the platform whale activity feed, expandable inline or in a full-page reader.' },
    { date: 'June 2026', tag: 'IMPROVED', text: 'Full brief detail pages now render each post with its cover, category, read time, and a live view counter, and link out to the original source where available.' },
  ],
};
