import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const whaleTrackerHowItWorks: HowItWorksContent = {
  title: 'Whale Tracker',
  tagline: 'Watch the largest wallets move, priced and labeled in real time.',
  howItWorks: [
    'Whale Tracker watches large wallets across every chain we support and streams their buys, sells, and transfers into one live feed.',
    'Every move is priced in US dollars the moment it lands, using live market data, so the size filters reflect real value rather than raw token counts.',
    'Wallets carry on-chain labels such as smart money, exchange, or insider, and strong performers show win rate and recent profit badges so you can read intent at a glance.',
    'The feed updates the instant new activity arrives. A pill lights up so you can pull in fresh moves without refreshing the page.',
  ],
  howToUse: [
    'Open the Live Feed and choose the chains you care about using the chain pills.',
    'Narrow the flow with the action, size, and time filters to focus on, for example, buys above 100k in the last hour.',
    'Tap any whale to open its profile and study its history, win rate, and holding behavior.',
    'Add a whale to your Watchlist, set a dollar threshold, and pick in-app or email alerts so you hear about its next move.',
  ],
  why: [
    'Whales often move before the crowd, so seeing their flow live gives you an early read on where momentum is building.',
    'Dollar-priced sizing and entity labels cut the noise, so your attention goes to the moves that actually matter.',
    'Alerts mean you do not have to watch the screen. The platform tells you when a wallet you trust makes a move.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'The live priced feed now covers every active whale and tracks both the received and sent side of each move.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The realtime indicator lights the new activity pill within a second of a move landing.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Following a whale now sends a durable in-app notification and an email when it crosses your dollar threshold.',
    },
  ],
};
