import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const alertsHowItWorks: HowItWorksContent = {
  title: 'Smart Alerts',
  tagline: 'Set conditions on wallets, prices, and new launches, then get pinged the moment they hit.',
  howItWorks: [
    'Smart Alerts supports four kinds of watch: whale wallet moves above a dollar threshold, price targets above or below a level, fresh token launches that clear your liquidity and holder filters, and any activity on a wallet you choose.',
    'The platform monitors your active alerts continuously in the background, checking prices frequently and wallets and new launches on a steady cycle, so you do not have to keep the page open and refresh it.',
    'Whale and price conditions are valued in US dollars using live market data, so your thresholds reflect real value rather than raw token amounts. Launch alerts can also filter by keywords in the token name or symbol.',
    'When a condition is met, you get an in-app notification and the alert is logged to a History tab so you can review what fired and when.',
  ],
  howToUse: [
    'Open Smart Alerts and tap Create in the header.',
    'Pick the alert type: Whale Tracker, Price Target, New Launch, or Wallet Activity.',
    'Fill in the details, such as a wallet address and dollar threshold, a token and target price, or your minimum liquidity and holder count, then save.',
    'Use the Test button on any alert to preview the notification, and the toggle to pause or resume it.',
    'Open the History tab to see every alert that has fired, most recent first.',
  ],
  why: [
    'Conditions run for you in the background, so you catch the moves that matter without staring at charts all day.',
    'Dollar-priced thresholds and holder and liquidity filters cut the noise, so alerts only fire when something is genuinely worth your attention.',
    'One place covers whales, prices, launches, and wallet activity, so all of your watches live together instead of scattered across tools.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Create whale, price, new launch, and wallet activity alerts in one place, with a Test button and a History tab that logs every trigger.',
    },
  ],
};
