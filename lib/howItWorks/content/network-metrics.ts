import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const networkMetricsHowItWorks: HowItWorksContent = {
  title: 'Network Metrics',
  tagline: 'A live read on the chains you trade on, pulled straight from on-chain nodes.',
  howItWorks: [
    'Network Metrics gives you a one-screen snapshot of the conditions that decide whether a trade is worth sending right now, including current gas price, throughput, and the latest block or slot for each supported chain.',
    'Coverage spans five networks: Ethereum, Solana, Base, Polygon, and Arbitrum, selectable from the chip row at the top so you can move between them without leaving the page.',
    'Every reading is queried live from Alchemy RPC nodes, the same infrastructure the rest of the platform relies on, and the calls fan out in parallel so all five chains come back together rather than one at a time.',
    'For the EVM chains the gas price is read directly from the node and shown in Gwei, while Solana reports its own fee and a throughput figure computed from recent network performance samples, so each number reflects how that specific chain actually behaves.',
    'The header card shows the selected chain with a healthy indicator, the four tiles below it break out Gas Price, throughput, Latest Block, and a live status, and the Network Stats panel restates the latest block alongside the data source and an overall health read.',
    'A higher gas figure means transactions are more expensive to land at that moment, the block or slot number climbing confirms the chain is producing blocks and keeping current, and the status tile tells you whether the page is still fetching or showing a live result.',
  ],
  howToUse: [
    'Open Network Metrics from the dashboard and let the page pull a fresh reading across all five chains.',
    'Pick a network from the chip row at the top to switch the whole view to Ethereum, Solana, Base, Polygon, or Arbitrum.',
    'Read the Gas Price tile first to gauge how costly a transaction is on the chain you have selected before you commit to sending one.',
    'Check the Latest Block tile and the throughput figure to confirm the network is current and keeping up rather than stalling.',
    'Watch the status tile to see whether readings are still loading or have settled into a live result.',
    'Open the Network Stats panel below to confirm the latest block, the data source, and the overall network health at a glance.',
    'Cycle through the chips to compare gas across networks and route your activity to whichever chain is cheapest at the moment.',
  ],
  why: [
    'Gas and throughput are the difference between a trade that lands cheaply and one that gets eaten by fees or arrives late, so seeing them live helps you act when conditions are favorable and hold off when they are not.',
    'Comparing several networks side by side in one place makes it easy to route the same activity to whichever chain is cheapest right now instead of guessing.',
    'Reading gas and block height straight from a node gives you an honest, current snapshot rather than a stale number, which matters most right before you sign a transaction or bridge between chains.',
    'It fits naturally at the start of a trading or research session, as a quick condition check you run before sizing up or moving funds.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Every reading now comes straight from live Alchemy RPC nodes rather than any fabricated or placeholder figures, with the data source shown in the Network Stats panel.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Read live gas prices, throughput, and the latest block or slot across Ethereum, Solana, Base, Polygon, and Arbitrum from a single screen.',
    },
  ],
};
