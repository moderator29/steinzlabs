import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const alertsHowItWorks: HowItWorksContent = {
  title: 'Smart Alerts',
  tagline: 'Set conditions on wallets, prices, and new launches, then get pinged the moment they hit.',
  howItWorks: [
    'Smart Alerts supports four kinds of watch: whale wallet moves above a dollar threshold, price targets that fire when a token crosses above or below a level, fresh token launches that clear your liquidity and holder filters, and any activity on a wallet you choose, across Ethereum, Solana, BSC, and Base.',
    'Every alert you create is stored on Naka servers and evaluated for you in the background, so it keeps running after you close the tab and stays in sync across your devices rather than living only in one browser.',
    'Price conditions are checked against live market data from the unified CoinGecko price service, and the top of the form searches that same catalog by name or symbol so you target the exact token you mean.',
    'Whale and wallet activity watches read recent transactions straight from on-chain sources, the Etherscan family of explorers for Ethereum, BSC, and Base, and the Helius or public Solana RPC for Solana, then whale alerts value each transfer in real dollars using the live native asset price so your threshold reflects value rather than raw token amounts.',
    'New launch watches scan the newest pump.fun coins and only surface a token once it clears your minimum liquidity and holder count, and optionally matches one of the keywords you list against its name or symbol.',
    'The three counters at the top show how many alerts are Active, how many are Paused, and the running total of how many times your alerts have Triggered, while each card summarizes its condition, how many times it fired, and how long ago.',
    'When a condition is met you get an in-app notification, and the same trigger is logged to the History tab, newest first, with the alert name, type, and the exact message describing what moved.',
  ],
  howToUse: [
    'Open Smart Alerts and tap Create in the header to open the new alert sheet.',
    'Pick the alert type: Whale Tracker for large wallet movements, Price Target for price levels, New Launch for fresh tokens, or Wallet Activity for any transaction.',
    'For a whale or wallet alert, paste the wallet address and choose its chain, and for whale alerts set the minimum transaction value in dollars so smaller moves stay quiet.',
    'For a price alert, search the token, choose whether you want to fire when price goes above or below, and enter your target price.',
    'For a launch alert, set the minimum liquidity and minimum holders, choose Solana or any chain, and optionally add comma separated keywords to only catch tokens whose name or symbol matches.',
    'Review the auto generated alert name, edit it if you want a clearer label, then save, and use the toggle on each card to pause or resume a watch without deleting it.',
    'Switch to the History tab to review every trigger that has fired, most recent first, and read the message that explains exactly what crossed your condition.',
  ],
  why: [
    'Conditions run for you in the background on Naka servers, so you catch the moves that matter without staring at charts all day or keeping the page open.',
    'Dollar priced whale thresholds, live price targets, and holder and liquidity filters cut the noise, so an alert only reaches you when something is genuinely worth your attention.',
    'One surface covers whales, prices, launches, and wallet activity across four chains, so every watch lives together instead of being scattered across separate tools and tabs.',
    'Reach for it when you are tracking a specific wallet, waiting on a price level to enter or exit, or hunting for early launches that fit your filters, and let the History tab become the audit trail of what actually fired.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Create whale, price, new launch, and wallet activity alerts in one place, each evaluated server side so they survive tab close and sync across your devices.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Whale alerts now value each transfer in real dollars using the live native asset price, so your minimum threshold reflects value instead of raw token amounts.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'The History tab now reads durable trigger records, so every alert that fires is logged with its name, type, and message, newest first, across all your devices.',
    },
  ],
};
</content>
</invoke>
