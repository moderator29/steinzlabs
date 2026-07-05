import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const sectorRotationHowItWorks: HowItWorksContent = {
  title: 'Narrative Radar',
  tagline: 'See which crypto narratives capital is rotating into and out of, ranked by 24-hour market-cap move.',
  howItWorks: [
    'Narrative Radar groups the market into sectors, the narratives traders actually talk about, such as AI, memes, DeFi, real-world assets, gaming, and DePIN, and measures how each sector’s total market cap moved over the last twenty-four hours.',
    'The numbers are real category aggregates from CoinGecko: each sector’s combined market cap, its twenty-four hour market-cap change, its trading volume, and the leading coins inside it.',
    'Sectors are split into two lists, the ones capital is rotating into, ranked by the biggest positive move, and the ones capital is rotating out of, ranked by the biggest decline, so the shift is readable at a glance.',
    'It refreshes on a short cache so you get a current read without hammering the source, and every figure traces back to a live category aggregate rather than an estimate.',
  ],
  howToUse: [
    'Open the radar and read the Rotating In list first, since that is where fresh momentum and attention are concentrating right now.',
    'Cross-check the Rotating Out list to see which narratives are cooling, which is often where the next reversal or the current source of rotation lives.',
    'Use the market cap and volume under each sector to judge whether a move is meaningful size or just a small-cap blip.',
    'Treat the leading-coin icons as a shortcut into each narrative when you want to drill from a sector into specific tokens.',
  ],
  why: [
    'Money in crypto moves in narratives before it moves in individual tokens, so watching sector rotation is one of the earliest reads on where the next run is forming.',
    'Seeing gainers and losers side by side turns a noisy market into a clear map of attention, which is exactly what you want at the start of a session.',
    'Reach for it when you are deciding what to research next, or when you want to confirm that a token you like is riding a sector that is actually catching a bid.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Narrative Radar launched: real 24-hour sector rotation from live category market caps, split into what capital is flowing into and out of.',
    },
  ],
};
