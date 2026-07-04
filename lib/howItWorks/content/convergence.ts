import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const convergenceHowItWorks: HowItWorksContent = {
  title: 'Convergence Radar',
  tagline: 'See the tokens that multiple tracked smart-money wallets are buying at the same time, ranked by how good those wallets are and how early you are.',
  howItWorks: [
    'Every time a wallet in the tracked whale directory buys or swaps into a token, that trade is recorded, and the platform continuously aggregates the last twenty-four hours to find tokens that two or more distinct smart-money wallets have entered together.',
    'Each convergence is scored, not just listed: the radar joins in the reputation of the specific wallets that converged, so a token bought by five wallets with high win rates ranks above one bought by eight random addresses, and it factors in how fresh the signal is so you catch it early rather than after the move.',
    'Stablecoins and wrapped majors such as USDC, USDT, WBTC, and WETH are demoted by default, because whales parking in them is portfolio housekeeping, not a trade signal, and you can toggle them back on if you want the full picture.',
    'Tapping any convergence asks VTX, the on-chain agent, to read the actual wallets involved and write a short thesis: what those wallets have in common, whether it reads as organic accumulation or a coordinated cluster, and how early the signal is, with a confidence read based on the strength of the underlying data.',
    'Everything on this page is real on-chain data drawn from the whale-activity pipeline and the whale reputation table, refreshed continuously, with no placeholder or sample numbers.',
  ],
  howToUse: [
    'Open Convergence Radar from the Whale Tracker tab bar to see the current board, ranked with the strongest alpha signal at the top.',
    'Filter by chain to focus on a single network, or leave it on All Chains to scan the whole market at once.',
    'Read each card at a glance: the alpha score, how many whales converged, the combined size, how long ago it started, the average win rate of those wallets, and the named wallets driving it.',
    'Tap a card to open the VTX thesis and understand why this particular convergence matters before you act.',
    'Use the View token button to jump straight to the token page, and toggle Show stables only when you want to include stablecoin and wrapped-major flows.',
  ],
  why: [
    'Most platforms show you that smart money moved as a flat number; the radar tells you which wallets moved, how good they are, and whether being early here is worth your attention, which is the difference between noise and a signal you can act on.',
    'Weighting by real, per-wallet win rates and demoting stablecoin housekeeping means the tokens that rise to the top are genuine accumulation by proven traders, not whatever had the most raw volume.',
    'The one-tap AI thesis turns a data point into a decision: instead of guessing why four wallets bought the same token, you get a specific, grounded read on the setup and what to watch next.',
    'Reach for it when you want to find what smart money is quietly accumulating before it trends, and pair it with the token page and your alerts to move from discovery to action in one flow.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Convergence Radar launched with reputation-weighted ranking, stablecoin demotion, and a one-tap VTX thesis on every convergence.',
    },
    {
      date: 'July 2026',
      tag: 'FIXED',
      text: 'The convergence pipeline now keeps one clean, continuously refreshed record per token instead of accumulating stale duplicates, so the board always reflects the live twenty-four hour window.',
    },
  ],
};
