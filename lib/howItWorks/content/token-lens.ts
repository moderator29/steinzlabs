import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const tokenLensHowItWorks: HowItWorksContent = {
  title: 'Token Whale Lens',
  tagline: 'Paste any token and instantly see which tracked whales are in it, how big their position is, and when they entered.',
  howItWorks: [
    'You enter a token by its symbol or its contract address, and the lens scans the whale-activity pipeline for every tracked whale that traded that token inside the window you choose.',
    'For each whale it totals how much they bought and sold, works out their net position, counts their trades, and records when they first entered and last acted, so you can tell a fresh entry from a wallet that has been in for weeks.',
    'Each whale is enriched with its reputation from the directory (label, archetype, and win rate) so you are not just seeing that a wallet is in the token, but how good that wallet actually is.',
    'A summary at the top rolls it all up: how many whales are involved, the combined net flow, and how many are accumulating versus distributing, which is the fastest read on whether smart money is entering or exiting.',
    'The list is ranked by the size of each whale’s net position, so the wallets moving the most conviction sit at the top, and you can switch the window between twenty-four hours, seven days, and thirty days.',
    'Everything is real on-chain data: only whales that genuinely traded the token appear, with honest blanks where a reputation value is unknown.',
  ],
  howToUse: [
    'Open Token Whale Lens from the Whale Tracker tab bar, or arrive here by drilling in from Smart Money Flows or the Convergence Radar.',
    'Type a token symbol such as AAVE, or paste a contract address for an exact match.',
    'Press Scan, then use the window buttons to move between fresh momentum and longer-term positioning.',
    'Read the summary first: net flow and the accumulating-versus-distributing count tell you the overall stance.',
    'Scan the ranked whales to see who has the biggest position, how strong their win rate is, and when they entered.',
  ],
  why: [
    'Before you buy a token, the single most useful question is whether proven smart money is already in it and still adding, and this lens answers that in one scan instead of manually checking wallets.',
    'Ranking by net position and showing entry timing separates early conviction from late chasers, and pairing each wallet with its win rate tells you whether the smart money in this token is actually smart.',
    'The accumulating-versus-distributing summary is an instant read on whether you are early to accumulation or late to a distribution, which is exactly the timing edge that matters.',
    'Reach for it to validate a token you are considering, to see who is behind a move you already spotted, or to check whether the whales that were accumulating have started to exit.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Token Whale Lens launched: scan any token to see which tracked whales hold it, their net position and entry timing, with an accumulating-versus-distributing summary, all from real whale activity.',
    },
  ],
};
