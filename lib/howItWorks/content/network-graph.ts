import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const networkGraphHowItWorks: HowItWorksContent = {
  title: 'Network Graph',
  tagline: 'See how money moves between wallets as a living, interactive map.',
  howItWorks: [
    'Network Graph reads on-chain transfers for a wallet or token and lays them out as a force-directed map, where each circle is an address and each line is a flow of value between two addresses.',
    'Node size reflects how much volume an address has moved, and color marks its role, such as a USDC or USDT flow, a high-activity wallet, or a known bridge or protocol, so you can read the shape of the network at a glance.',
    'The arrows on each link show the direction of the transfer, while line thickness reflects how often two addresses have transacted.',
    'A side panel summarizes the network with cluster, density, and average-degree stats, ranks the most connected wallets, and charts transfer activity over the last 24 hours.',
  ],
  howToUse: [
    'Type a wallet address or token contract into the search bar to choose what to map.',
    'Press Analyze to build the graph around your target, pulling live on-chain transfer data.',
    'Scroll to zoom, drag the canvas to pan, and drag any node to reposition it.',
    'Hover a node to highlight its direct connections and see its volume and transaction count, or click it to pin a detail panel.',
    'Use the legend and the Top Wallets list to find the hubs that route the most flow.',
  ],
  why: [
    'A picture of who funds whom exposes patterns that a flat transaction list hides, such as hubs, clusters, and bridges between groups of wallets.',
    'Sizing by volume and labeling by role lets you spot the addresses that actually steer a network rather than the noise around them.',
    'Searching any wallet or token on demand turns raw transfer history into a map you can explore in seconds.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Search any wallet or token to render an interactive, force-directed map of on-chain transfers, sized by volume and labeled by entity role.',
    },
  ],
};
