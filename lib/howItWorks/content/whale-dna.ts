import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const whaleDnaHowItWorks: HowItWorksContent = {
  title: 'Whale DNA',
  tagline: 'Decode any tracked wallet into a behavioral fingerprint, then instantly find every other wallet that trades just like it.',
  howItWorks: [
    'You paste a wallet address or tap one of the top tracked whales, and the page pulls that wallet from the curated whale directory along with its recent on-chain activity.',
    'The wallet is rendered as a genome: its archetype, win rate, whale score, thirty-day profit and loss, seven-day volume, trade count, average holding time, and the signature tokens it has been buying most.',
    'The platform then compares that fingerprint against every other tracked wallet on the same chain and scores how similar each one is, blending whether they share the same archetype, how close their win rates, scores, and holding times are, and how much their token sets overlap.',
    'To stay fast and accurate it works in two passes: first it shortlists the closest wallets on behavior alone, then it refines that shortlist by measuring real token overlap from the whale-activity pipeline, so the final matches are behaviorally and positionally alike.',
    'The result is a ranked list of the wallets that trade most like the one you searched, each with a match percentage and the specific tokens they hold in common, and every match is itself clickable so you can walk the cohort.',
    'All of it is real data from the whale reputation table and the whale-activity pipeline, with honest blanks wherever a value is genuinely unknown.',
  ],
  howToUse: [
    'Open Whale DNA from the Whale Tracker tab bar.',
    'Paste a wallet address and press Decode, or tap a top-whale chip to start from a known-good wallet.',
    'Read the genome card at the top to understand how this wallet actually trades.',
    'Scroll the "trades like this wallet" list to find its behavioral cohort, ranked by match percentage with the shared tokens called out.',
    'Tap any match to decode that wallet in turn and keep walking the network of similar traders.',
  ],
  why: [
    'Finding one wallet that consistently wins is valuable, but finding the entire cohort that trades like it multiplies that edge, because coordinated or like-minded smart money tends to move into the same names.',
    'Matching on real behavior and token overlap rather than just labels means the cohort you get is genuinely similar in how it trades, not just wallets that happen to share a tag.',
    'Because every match is clickable, one good wallet becomes a doorway into a whole network of proven traders you would never have found by scrolling a directory.',
    'Reach for it when you have found an alpha wallet and want to discover its peers, when you want to confirm a wallet is part of a real winning cohort before copying it, or when you are mapping how a group of smart wallets is connected by behavior.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Whale DNA launched: turn any tracked wallet into a behavioral fingerprint and surface the wallets that trade most like it, ranked by a real behavior-plus-token-overlap match score.',
    },
  ],
};
