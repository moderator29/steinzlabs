import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const smartMoneyFlowsHowItWorks: HowItWorksContent = {
  title: 'Smart Money Flows',
  tagline: 'See which tokens the tracked whale directory is net-buying versus net-selling right now, ranked by the size of the move.',
  howItWorks: [
    'Every buy and sell recorded from the tracked whale directory is continuously aggregated by token over a rolling window you choose, so each token shows the total dollars flowing in from buys and out from sells.',
    'The net figure is simply inflow minus outflow: a large positive net means smart money is accumulating that token, while a large negative net means they are distributing it, and the board is ranked by how big that move is in either direction.',
    'Each row also shows how many distinct whales traded the token, and a split bar that visualizes the balance between buying and selling pressure at a glance, so you can tell broad accumulation from a single large trade.',
    'Stablecoins and wrapped or native majors are demoted by default, because whales rotating cash or blue-chips is portfolio housekeeping rather than a trade signal, and you can toggle them back on to see the full picture.',
    'You can narrow the board to a single chain and switch the window between twenty-four hours, seven days, and thirty days to move between fresh momentum and sustained conviction.',
    'Every number is a real aggregation of on-chain whale activity, with tokens shown only when at least two distinct whales traded them, so a single wallet cannot manufacture a signal.',
  ],
  howToUse: [
    'Open Smart Money Flows from the Whale Tracker tab bar.',
    'Pick a window: 24h for fresh momentum, 7d or 30d for sustained conviction.',
    'Filter by chain to focus on one network, or leave it on All chains.',
    'Read the board top-down: green net-in means accumulation, red net-out means distribution, and the split bar shows the buy-versus-sell balance.',
    'Toggle Show stables/majors when you want to include cash and blue-chip rotation in the ranking.',
  ],
  why: [
    'Knowing what proven wallets are collectively accumulating before it trends is the core smart-money edge, and this board turns thousands of individual trades into one ranked, readable signal.',
    'The net inflow-minus-outflow view separates real conviction from noise: a token many whales are net-buying is a very different signal from one with a single large print, and the split bar and whale count make that obvious.',
    'Demoting stablecoins and majors by default keeps the board focused on the tokens where whale attention actually means something, instead of being dominated by cash rotation.',
    'Reach for it to spot early accumulation, to confirm that a token you are watching has real smart-money support, or to catch distribution before a top, then pair it with the Convergence Radar and token pages to act.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Smart Money Flows launched: a net accumulation-versus-distribution board over real whale activity, with per-token buy/sell split, whale counts, chain and window filters, and stablecoin/major demotion.',
    },
  ],
};
