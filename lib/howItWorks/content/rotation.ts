import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const rotationHowItWorks: HowItWorksContent = {
  title: 'Smart Money Rotation',
  tagline: 'See where whale attention is moving TO, not just where it already is — the tokens smart money is rotating into and out of before it shows up as a big number.',
  howItWorks: [
    'For every token the tool measures the net whale flow — buys minus sells — over the window you choose, and then measures the same thing over the window immediately before it.',
    'The difference between those two figures is the rotation signal: a large positive change means smart money has accelerated into a token, and a large negative change means it has accelerated out, regardless of how big the raw flow is.',
    'This is deliberately different from an absolute flow board, because a token can still have a small total flow while undergoing a dramatic shift in sentiment, and it is that shift that tends to lead price.',
    'The strongest cases are flips, where a token that whales were net selling in the prior window becomes net bought in the current one, or vice versa, and those are marked with a flip badge so they stand out.',
    'Results are split into two columns — rotating in and rotating out — each ranked by the size of the change, with the prior-to-current flow shown so you can see the move, and stablecoins and majors demoted by default as housekeeping noise.',
    'Every number is a real aggregation of on-chain whale activity, shown only when at least two distinct whales traded the token so a single wallet cannot manufacture a rotation.',
  ],
  howToUse: [
    'Open Smart Money Rotation from the Whale Tracker tab bar.',
    'Pick a window — the tool always compares it against the equal window just before, so 24h compares the last day to the day before, and so on.',
    'Read the left column for what smart money is rotating into and the right column for what it is rotating out of.',
    'Watch for the flip badge — a token that swung from net selling to net buying is the highest-signal rotation.',
    'Tap any token to open the Token Whale Lens and see exactly which wallets are behind the move.',
  ],
  why: [
    'Price tends to follow changes in smart-money positioning more than the absolute level of it, so catching the acceleration — the rotation — is often earlier than catching the flow itself.',
    'A token quietly flipping from distribution to accumulation by proven wallets is one of the cleanest early signals there is, and it is invisible on a board that only shows current totals.',
    'Splitting rotation into and out of tokens gives you both sides of the trade: what to look at, and what smart money is quietly leaving.',
    'Reach for it to find rotations before they trend, to confirm that a token you are watching is gaining or losing smart-money conviction, and pair it with the Flows board and Token X-Ray to go from signal to decision.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Smart Money Rotation launched: a two-window view of where whale net-flow is accelerating in and out, with flip badges for tokens that swung from selling to buying, over real whale activity.',
    },
  ],
};
