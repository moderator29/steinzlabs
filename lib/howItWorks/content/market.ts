import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const marketHowItWorks: HowItWorksContent = {
  title: 'Market',
  tagline: 'Live prices across the top crypto assets, with one click into a full trading terminal.',
  howItWorks: [
    'Market opens on a ranked table of the top assets by market cap, pulling live data from CoinGecko through the platform price service, with CoinCap as an automatic fallback so the list never goes blank when the primary source is rate-limited or slow.',
    'Each row shows the live price, 1H, 24H and 7D percentage change, 24H volume, market cap, a 7-day sparkline chart, and a star to save the asset to your watchlist.',
    'Category pills let you focus the list by theme, including All, Majors, DeFi, Layer 1, Layer 2, Gaming, AI, Meme, and DePIN, where Majors tracks the current top ten by market cap live rather than a frozen list.',
    'The Pump.fun and BNB Meme pills are sourced from DexScreener instead of CoinGecko, so newer on-chain pairs that the major indexes do not track tightly still surface with price, volume, and change reshaped into the same table format.',
    'Search matches by name or ticker against the loaded list, and when you paste a contract address it resolves the exact token through CoinGecko, probing each supported EVM chain plus Solana so the right match links straight into its terminal.',
    'A Top Gainers strip sits above the table and surfaces the strongest 24H movers from the current data as quick chips you can tap to open directly.',
    'Prices are served with short edge caching and stale-while-revalidate, and switching categories reuses recent in-process results so flipping between tabs stays instant rather than refetching the same data.',
  ],
  howToUse: [
    'Open Market to see live prices ranked by market cap across the top assets, with the Top Gainers strip highlighting the day\'s strongest moves.',
    'Tap a category pill such as Majors, DeFi, Layer 1, AI, or Meme to focus the list on one theme, or choose Pump.fun or BNB Meme to browse newer on-chain pairs.',
    'Use the search box to find an asset by name or ticker, or paste a contract address to resolve a specific token across chains.',
    'Open Filters to set a market cap range and a minimum 24H volume, then choose to sort by market cap, volume, or 24H price change.',
    'Read each row across price, the 1H, 24H and 7D change columns, volume, market cap, and the 7-day sparkline to judge momentum at a glance.',
    'Tap the star on any row to save the asset to your watchlist for quick access later.',
    'Click any row, search result, or gainer chip to open that token in its full trading terminal.',
  ],
  why: [
    'One screen gives you a clean, ranked read on the market across price, change, volume, and market cap without juggling several separate price sites.',
    'Theme categories and contract resolution put blue chips and brand new on-chain pairs in the same place, so you can scan the majors and hunt newer markets in a single flow.',
    'The filters and sort controls turn the table into a fast screener, letting you narrow to a cap band and a volume floor before ranking by the metric you care about.',
    'Every row is a direct path into trading, so spotting a move and acting on it stays in one continuous workflow rather than a hand-off between tools.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'Token pages now report honest trade data: missing buy and sell counts read as unknown instead of a fabricated split, and the Recent Trades rail shows Idle over an empty tape.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Switching categories now reuses recent results in process and coalesces duplicate requests, so flipping between tabs feels instant instead of refetching the same data each time.',
    },
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'Search results and contract matches now route to each token\'s real chain, so native Layer 1 and Layer 2 assets open on the correct terminal instead of defaulting to Ethereum.',
    },
  ],
};
