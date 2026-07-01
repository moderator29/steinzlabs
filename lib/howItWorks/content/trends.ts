import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const trendsHowItWorks: HowItWorksContent = {
  title: 'On-Chain Trends',
  tagline: 'See where capital is flowing across chains with live, dollar-denominated metrics.',
  howItWorks: [
    'On-Chain Trends turns raw network activity into a grid of intelligence cards so you can read where money is moving without digging through block explorers or separate dashboards.',
    'Total value locked figures come from DeFiLlama, covering a global all-chains total plus the top chains ranked by TVL, while the aggregate stablecoin market cap is pulled from the same source as a measure of dollar liquidity sitting on chain.',
    'When DEX coverage is available, the platform layers in real 24 hour decentralized exchange volume and unique active trader counts per chain from Bitquery, so trading throughput and participation sit alongside the liquidity numbers.',
    'Each TVL card shows the current dollar value, its 24 hour and 7 day percentage change, a direction marker, and a fourteen point sparkline built from real history so you can read momentum at a glance, while volume and address cards show the latest live figure.',
    'Cards with outsized 24 hour moves are flagged as hot and sorted to the top of the grid, and the sharpest swings are promoted into severity-ranked trend alerts that name the chain, the metric, and the size of the move.',
    'A summary strip reports how many metrics are currently hot and how many chains are being tracked, and tapping any card opens a detail view with a larger trend chart and, when present, a plain language read on what the move suggests.',
    'Results are cached briefly on the server and served fresh, so the live timestamp in the header reflects when the underlying network data was last pulled.',
  ],
  howToUse: [
    'Open On-Chain Trends to load the latest metrics across the chains the platform tracks, starting with the all-chains view.',
    'Scan the trend alerts at the top first, since these surface the chains and metrics with the largest moves ranked by severity.',
    'Check the summary strip to see how many metrics are running hot and how many chains are in view before you read the grid.',
    'Use the chain pills to narrow the grid to a single network or switch back to all chains together when you want the full picture.',
    'Read each card by pairing the dollar value with its 24 hour and 7 day change and the sparkline shape to judge whether a move is a spike or a sustained trend.',
    'Tap any card to open its detail view and study the full trend chart, the alert text, and the analysis read where one is available.',
    'Tap refresh whenever you want to pull the freshest numbers, and watch the header timestamp update to confirm the new pull.',
  ],
  why: [
    'On-chain activity often shifts before price does, so watching total value locked, stablecoin liquidity, DEX volume, and active addresses gives you an early read on momentum and rotation between chains.',
    'Dollar-denominated values with clear 24 hour and 7 day change percentages let you compare networks on the same footing and cut through the noise of raw token counts.',
    'Severity-ranked alerts and hot flags do the scanning for you, surfacing the moves worth your attention so you are not manually combing every chain and metric.',
    'Reach for it at the start of a research session to set the macro backdrop, or whenever you suspect capital is rotating, before drilling into individual tokens, wallets, or trades elsewhere on the platform.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Added real 24 hour DEX volume and unique active trader cards per chain from Bitquery, sitting alongside the existing total value locked metrics.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Sparklines and 7 day change now build from real DeFiLlama history, with stablecoin totals showing the live figure instead of any synthetic series.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Track total value locked, stablecoin market cap, and per-chain activity across top chains, with hot metric flags, a hot and chains-tracked summary, and severity-ranked trend alerts.',
    },
  ],
};
