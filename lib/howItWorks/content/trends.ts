import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const trendsHowItWorks: HowItWorksContent = {
  title: 'On-Chain Trends',
  tagline: 'See where capital is flowing across chains with live, dollar-denominated metrics.',
  howItWorks: [
    'On-Chain Trends reads live network data such as total value locked, DEX volume, active addresses, and stablecoin supply, then turns each one into a clean intelligence card.',
    'TVL cards show the current value, its 24 hour and 7 day change, and a short sparkline so you can read direction at a glance, while volume and address cards show the latest figure.',
    'Cards with unusually large moves are marked hot and float to the top, and sharp swings raise trend alerts ranked by severity.',
    'Tapping a card opens a detail view with a larger trend chart and, when available, a plain language read on what the move suggests.',
  ],
  howToUse: [
    'Open On-Chain Trends to load the latest metrics across the chains we track.',
    'Use the chain pills at the top to focus on a single network or view all chains together.',
    'Scan the trend alerts and the hot metric count to spot where the biggest moves are happening.',
    'Tap any card to open its detail view and study the full 7 day trend and analysis.',
    'Tap refresh whenever you want to pull the freshest numbers.',
  ],
  why: [
    'On-chain activity often shifts before price does, so watching capital flow gives you an early read on momentum.',
    'Dollar-denominated values and clear change percentages let you compare chains fairly and skip the noise.',
    'Severity-ranked alerts surface the moves worth your attention so you do not have to scan every metric yourself.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Track total value locked, DEX volume, active addresses, and stablecoin supply across top chains, with hot metric flags and severity-ranked trend alerts.',
    },
  ],
};
