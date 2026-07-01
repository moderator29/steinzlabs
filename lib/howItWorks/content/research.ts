import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const researchHowItWorks: HowItWorksContent = {
  title: 'Research Lab',
  tagline: 'A live on-chain newsroom that pairs real-time market signals with published research and a daily market read.',
  howItWorks: [
    'Research Lab is the platform reading room, stacking three layers on one page: a real-time Live Wire of on-chain events, a full daily Market Brief, and a searchable feed of published research posts.',
    'The Live Wire subscribes to the same intelligence layer as the Context Feed over a server-sent stream with automatic polling fallback, surfacing whale moves, smart-money flows, security flags, new listings, network pulse, and broad market signals across Solana, Ethereum, BSC, Polygon, Avalanche, Base, Arbitrum, and Optimism.',
    'Each wire card carries a chain badge, token symbol, live price and 24 hour change, on-chain value, and a signal confidence score out of 100 with a sentiment read, so you can weigh how strong and how bullish or bearish each event is before acting.',
    'The Market Brief is an automated daily read assembled from CoinGecko, covering top gainers and losers among the largest tokens, the overall market mood, and trending searches, combined with the platform whale activity feed to surface the biggest priced whale moves of the last 24 hours.',
    'The Latest Research feed pulls published briefs and analysis, each tagged by category such as DeFi, Layer2, Security, On-Chain, or Market Analysis and by the source it came from, including CoinGecko, DexScreener, and CryptoPanic, with an estimated read time on every card.',
    'The page leads with the freshest story flagged as Breaking, refreshes itself every five minutes, and shows how long ago the data last updated, so what you read reflects current conditions rather than a stale snapshot.',
  ],
  howToUse: [
    'Open Research Lab and start with the Live Wire at the top to scan the most recent on-chain signals streaming in.',
    'Tap any wire card to expand its detail, where you can read its signal confidence, sentiment, volume, liquidity, and market cap, then choose View full proof to open the underlying evidence.',
    'Read the Market Brief below the wire, using Read the full brief to expand the complete daily read or Open in reader for the full-page view.',
    'Use the search box to find published posts by title, summary, or tag, and clear it any time to return to the full feed.',
    'Tap a category tab to focus on a topic, or open Filters to switch the sort between Latest and Trending and narrow by category from the panel.',
    'Tap any research card to read the full brief, then use View Source to open the original where a link is available.',
    'Hit the refresh control whenever you want the newest posts and signals immediately, instead of waiting for the automatic five minute refresh.',
  ],
  why: [
    'It collapses several tabs into one workspace, putting real-time on-chain signal, a daily market read, and vetted research side by side so you spend less time hunting across sites and more time acting on what matters.',
    'Reach for it at the start of a session to get oriented, when an unusual whale move or security flag breaks, or when you want context behind a token before you trade it.',
    'Live sourcing, named provenance on every item, and a confidence score per signal let you judge where each read comes from and how much weight to give it, instead of trusting an unattributed headline.',
    'It sits naturally upstream of the rest of the platform: spot a signal here, open its proof, then move into the deeper analysis and execution tools with the context already in hand.',
  ],
  whatsNew: [
    { date: 'June 2026', tag: 'NEW', text: 'A Live Wire now leads the page with real-time on-chain events across eight chains, each card carrying a signal confidence score, sentiment, and a path to view its full proof.' },
    { date: 'June 2026', tag: 'NEW', text: 'An automated daily Market Brief publishes a real read of the market built from live CoinGecko data and the platform whale activity feed, expandable inline or in a full-page reader.' },
    { date: 'June 2026', tag: 'IMPROVED', text: 'Full brief detail pages now render each post with its cover, category, read time, and a live view counter, and link out to the original source where available.' },
  ],
};
