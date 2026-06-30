import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const networkMetricsHowItWorks: HowItWorksContent = {
  title: 'Network Metrics',
  tagline: 'A live read on the chains you trade on, pulled straight from on-chain nodes.',
  howItWorks: [
    'Network Metrics queries live RPC nodes for each supported chain and surfaces the numbers that matter for timing a trade, including current gas price, throughput, and the latest block.',
    'Coverage spans Ethereum, Solana, Base, Polygon, and Arbitrum, so you can compare conditions across the networks side by side from one screen.',
    'Gas prices and block height come from a real node read each time the page loads, queried in parallel so all five chains arrive together.',
    'Readings are fetched when you open the page, giving you a current snapshot of each chain at the moment you check.',
  ],
  howToUse: [
    'Open Network Metrics from the dashboard.',
    'Pick a chain from the row at the top to switch the view to that network.',
    'Read the gas price to gauge how expensive transactions are before you send one.',
    'Check the latest block and throughput to confirm the network is keeping up and producing blocks.',
    'Watch the status tile to see whether readings are loading or live.',
  ],
  why: [
    'Gas and throughput decide whether a trade is worth sending, so seeing them live helps you act when conditions are favorable and wait when they are not.',
    'Comparing networks in one place makes it easy to route activity to whichever chain is cheapest at the moment.',
    'Reading gas and block height straight from the node gives you an honest snapshot instead of a stale guess.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Read live gas prices and block height across Ethereum, Solana, Base, Polygon, and Arbitrum from a single screen.',
    },
  ],
};
