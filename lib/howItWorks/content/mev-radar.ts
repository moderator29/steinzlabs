import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const mevRadarHowItWorks: HowItWorksContent = {
  title: 'MEV Radar',
  tagline: 'See how much wallets are quietly losing to MEV — sandwich attacks and frontrunning — over the last thirty days, and check any wallet’s toll.',
  howItWorks: [
    'MEV, short for maximal extractable value, is the profit bots take by reordering, inserting, or front-running transactions around yours, and it acts as an invisible tax that most traders never see itemized.',
    'The radar reads a thirty-day aggregate of measured MEV losses per wallet, broken down into how many times the wallet was sandwiched and how many times it was frontrun, along with the total dollars extracted.',
    'The main view is a leaderboard of the biggest victims, ranked by total loss, with each wallet enriched by its directory label and archetype where we know it, so you can see that even large, sophisticated wallets bleed real money to MEV.',
    'You can also look up any single wallet to see its own MEV toll, summed across chains, with the sandwich and frontrun counts that make up the number.',
    'Every figure is real, measured on-chain data with an honest empty state when a wallet has not been indexed or has not been hit by measurable MEV in the window.',
  ],
  howToUse: [
    'Open MEV Radar from the sidebar to see the leaderboard of the biggest MEV victims.',
    'Paste any wallet address and press Check to see that wallet’s own thirty-day MEV toll and attack counts.',
    'Use the Board button to return from a lookup to the leaderboard.',
    'Read each row: the red figure is the dollars lost, and the small icons show how many sandwich and frontrun events made it up.',
  ],
  why: [
    'MEV is one of the largest and least understood costs in trading, and making it visible per wallet turns an abstract risk into a concrete number you can actually react to.',
    'Seeing that even elite wallets lose six and seven figures to MEV is a powerful reminder to use protections like private routing and tight slippage, which is exactly the behavior this surface is meant to prompt.',
    'A per-wallet lookup lets you quantify your own exposure instead of guessing, which is the first step to reducing it.',
    'Reach for it to understand how much MEV is really costing the market, to check a wallet you manage before tuning its execution, or simply to appreciate why routing and slippage settings matter.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'MEV Radar launched: a leaderboard of the biggest MEV victims plus a per-wallet lookup showing thirty-day losses to sandwich attacks and frontrunning, from real measured on-chain data.',
    },
  ],
};
