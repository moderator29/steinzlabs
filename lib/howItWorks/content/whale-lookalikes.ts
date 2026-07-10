import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const whaleLookalikesHowItWorks: HowItWorksContent = {
  title: 'Whale Look-Alikes',
  tagline: 'Give it one whale and it finds the wallets that trade with the same behavioral DNA.',
  howItWorks: [
    'Look-Alikes turns each tracked whale into a behavioral fingerprint built only from real metrics we already compute: win rate, average hold time, thirty-day trade count, seven-day volume, and the whale score.',
    'Every metric is standardized across the whole active whale directory, so a wallet that simply moves huge dollar amounts does not automatically look similar to another big wallet. Similarity is measured on trading style, not size.',
    'For the whale you enter, the engine measures the distance between its fingerprint and every other whale, gives a small bonus when the archetype matches, and returns the closest matches as a zero to one hundred percent similarity score.',
    'Because it runs over the same directory that powers the tracker, the matches inherit real names, avatars, verified badges, and archetypes wherever we have them.',
  ],
  howToUse: [
    'Paste any tracked whale address into the box, or open this page from a whale with its address already filled in, then tap Match.',
    'Read the target card at the top to confirm the wallet and its headline behavior, then scan the ranked matches below.',
    'Each match shows its similarity percentage plus win rate, trade count, and recent volume, so you can see why it is close.',
    'Tap any match to pivot and genome-match that wallet in turn, walking a cluster of similar traders.',
  ],
  why: [
    'When you find one wallet worth watching, its look-alikes are the fastest way to widen the net to a whole cohort that trades the same way.',
    'Behavioral matching surfaces coordinated or copycat wallets that a pure balance ranking would never place next to each other.',
    'Reach for it when you want to build a watchlist around a style (a patient accumulator, a fast scalper, a momentum degen) rather than a single address.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Whale Look-Alikes launched: enter any tracked whale and get the wallets with the closest behavioral fingerprint, scored on real win rate, hold time, trade count, volume, and whale score.',
    },
  ],
};
