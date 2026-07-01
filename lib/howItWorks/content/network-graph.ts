import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const networkGraphHowItWorks: HowItWorksContent = {
  title: 'Network Graph',
  tagline: 'See how money moves between wallets as a living, interactive map.',
  howItWorks: [
    'Network Graph reads recent on-chain stablecoin transfers around a wallet or token and lays them out as a force-directed map, where each circle is an address and each line is a USDC or USDT flow between two addresses.',
    'When you search a wallet, the graph is built from live Alchemy Solana RPC data: it pulls the most recent transaction signatures, fetches the parsed transactions, and derives transfers from the before and after token balances so every node and edge reflects activity that actually happened on chain.',
    'When the input looks more like a token, the pipeline falls back to DexScreener pair data, mapping base tokens, quote tokens, and pool addresses into nodes and connecting them by trading volume and 24 hour transaction counts, and the source badge in the panel always tells you which feed produced the current view.',
    'Node size scales with the volume an address has moved, arrows show the direction of each transfer, and line thickness grows with how often two addresses have transacted, so the busiest routes stand out without reading a single number.',
    'Fill color marks a detected community computed by a real label-propagation pass over the observed edges, while the ring and label mark entity role such as a USDC or USDT mint, a known protocol or bridge like Jupiter, Orca, or Raydium, or a high-activity wallet, letting you separate genuine clusters from incidental neighbors.',
    'The side panel turns the same graph into readable stats, showing the number of detected clusters, average degree, density, and USDC and USDT transaction counts, ranking the most connected wallets, and charting transfer activity across the last 24 hours in three-hour buckets.',
  ],
  howToUse: [
    'Type a wallet address or a token contract address into the search bar at the top to choose what you want to map.',
    'Press Analyze to build the graph around your target, which pulls live transfer data and renders the network once it resolves.',
    'Scroll to zoom, drag the canvas to pan, and drag any node to reposition it and untangle a dense cluster.',
    'Hover a node to highlight its direct connections and read its volume, transaction count, and number of links in the floating tooltip.',
    'Click a node to pin a detail panel with its full address, volume, transaction count, connection count, and detected cluster, and click empty space to clear the selection.',
    'Read the Network Overview, Top Wallets by Connections, and Transfer Timeline panels on the left to find the hubs and the busiest windows, and open the Legend to map each color and ring back to a community or entity role.',
    'Use Refresh to repull the current target, or change the search box and Analyze again to pivot to a new wallet or token.',
  ],
  why: [
    'A picture of who funds whom exposes structure that a flat transaction list hides, including hubs, tightly knit clusters, and the bridges that connect otherwise separate groups of wallets.',
    'Sizing by volume, coloring by detected community, and labeling by entity role together let you spot the addresses that actually steer flow rather than the noise around them, which is exactly what you want when you are vetting a token or tracing where funds went.',
    'Because you can search any wallet or token on demand and the map is built only from real Alchemy or DexScreener data, raw transfer history becomes something you can explore visually in seconds instead of parsing block explorers by hand.',
    'It fits naturally between discovery and a deeper dive, giving you a fast topology read before you commit to wallet-level or token-level research.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Nodes are now colored by communities detected with a real label-propagation pass over the observed transfer edges, with the cluster count surfaced in the overview stats and omitted honestly when there are too few nodes to cluster.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'The entity palette was extended beyond stablecoin and protocol roles to cover exchange, market maker, smart money, and new wallet tiers, so the ring and legend describe more of what each address is.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Search any wallet or token to render an interactive force-directed map of on-chain transfers, sized by volume, with a side panel for cluster, density, top wallet, and 24 hour timeline stats.',
    },
  ],
};
