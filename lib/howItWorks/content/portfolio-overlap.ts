import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const portfolioOverlapHowItWorks: HowItWorksContent = {
  title: 'Smart Money Overlap',
  tagline: 'Cross-references your own holdings against what tracked whales are doing, so you can see which of your bags smart money is buying with you and which they are quietly dumping.',
  howItWorks: [
    'The tool reads the tokens in your connected wallet and, for each one, looks up how the tracked whale directory has traded that same token over the last thirty days.',
    'For every holding it works out the net whale flow — total buys minus total sells — and how many distinct whales were involved, then labels it as smart money accumulating, distributing, or flat.',
    'Your holdings are ordered so anything smart money is distributing rises to the top as a warning, followed by what they are accumulating with you, followed by tokens outside the tracked set.',
    'A summary shows at a glance how many of your positions have smart money buying, how many have it selling, and how many are not tracked at all.',
    'Only the token symbols from your wallet are used to run the lookup — your wallet address is never sent to the query or stored — and every figure is real whale-activity data with an honest not-tracked label where a token is outside the directory.',
  ],
  howToUse: [
    'Open Smart Money Overlap from your Portfolio.',
    'Make sure your wallet is connected so your holdings can be read.',
    'Scan the top of the list first — those are the holdings smart money is distributing, which are worth a closer look.',
    'Check the green accumulating tokens to confirm which of your positions the smart money is backing.',
    'Use the whale net figure and whale count to judge how strong each signal is.',
  ],
  why: [
    'Knowing that proven wallets are accumulating a token you already hold is real confirmation of your thesis, and knowing they are quietly dumping one is an early warning you would otherwise miss.',
    'Applying the smart-money lens to your actual portfolio, rather than the whole market, turns a general signal into a personal one about the exact bags you own.',
    'Sorting distributing positions to the top means the most actionable warnings are the first thing you see.',
    'Reach for it as a periodic health check on your holdings, before adding to a position to see if smart money agrees, or to catch a holding that smart money has started to exit before the price reflects it.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Smart Money Overlap launched inside Portfolio: your holdings cross-referenced against tracked-whale flow, labelling each as accumulating, distributing, or flat — a personalized conviction check.',
    },
  ],
};
