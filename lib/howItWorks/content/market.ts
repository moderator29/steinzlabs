import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const marketHowItWorks: HowItWorksContent = {
  title: 'Market',
  tagline: 'Live prices across the top crypto assets, with one click into a full trading terminal.',
  howItWorks: [
    'The table streams live market data sourced from CoinGecko, including price, 1H, 24H and 7D change, volume, market cap, and a 7-day sparkline.',
    'Category pills filter the list by theme such as majors, DeFi, layer 1, layer 2, gaming, AI, and memes, with Pump.fun and BNB meme markets pulled from DexScreener so newer pairs still show up.',
    'Search matches by name or ticker against the loaded list, and pasting a contract address resolves the exact token across chains so you can jump straight to it.',
    'Filters let you narrow by market cap range and minimum 24H volume, then sort by market cap, volume, or 24H price change.',
  ],
  howToUse: [
    'Open Market to see live prices ranked by market cap across the top assets.',
    'Pick a category pill to focus on a theme, or use Filters to set a market cap range and minimum volume.',
    'Search by name or ticker, or paste a contract address to resolve a specific token.',
    'Tap the star on any row to save it to your watchlist for quick access later.',
    'Click any row to open that token in its full trading terminal.',
  ],
  why: [
    'One screen gives you a clean, ranked view of the market without juggling multiple price sites.',
    'Theme categories and contract search surface both blue chips and brand new pairs in the same place.',
    'Every row is a direct path into trading, so spotting a move and acting on it stays in one flow.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'Token pages now report honest trade data: missing buy and sell counts read as unknown instead of a fabricated split, and the Recent Trades rail shows Idle over an empty tape.',
    },
  ],
};
