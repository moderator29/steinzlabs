import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const networkMetricsHowItWorks: HowItWorksContent = {
  title: 'Network Metrics',
  tagline: 'A live read on the health of the chains you trade on, pulled straight from on-chain nodes.',
  howItWorks: [
    'Network Metrics queries live RPC nodes for each supported chain and surfaces the numbers that matter for timing a trade: current gas price, transactions per second, and the latest block.',
    'Coverage spans Ethereum, Solana, Base, Polygon, and Arbitrum, so you can compare conditions across the networks side by side from one screen.',
    'Every figure comes from a real node read rather than a cached estimate, and a health indicator shows whether the selected network is running smoothly.',
    'Readings are fetched fresh when you open the page and refreshed on a short interval, so what you see reflects the chain right now.',
  ],
  howToUse: [
    'Open Network Metrics from the dashboard.',
    'Pick a chain from the row at the top to switch the view to that network.',
    'Read the gas price to gauge how expensive transactions are before you send one.',
    'Check the transactions per second and latest block to confirm the network is keeping up and producing blocks.',
    'Glance at the status and health indicators to see at a glance whether the chain is healthy.',
  ],
  why: [
    'Gas and throughput decide whether a trade is worth sending, so seeing them live helps you act when conditions are favorable and wait when they are not.',
    'Comparing networks in one place makes it easy to route activity to whichever chain is cheapest and fastest at the moment.',
    'Live node data gives you an honest signal of network health instead of a stale guess.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Track live gas, throughput, and block height across Ethereum, Solana, Base, Polygon, and Arbitrum from a single screen.',
    },
  ],
};
