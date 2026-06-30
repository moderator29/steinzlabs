import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const pricingHowItWorks: HowItWorksContent = {
  title: 'Pricing',
  tagline: 'Pick the plan that matches how you trade, from a free starter tier up to the full Max toolkit.',
  howItWorks: [
    'The Pricing page lays out four platform tiers side by side (Free, Mini, Pro, and Max), each one a strict superset of the tier below it, so moving up only ever adds capability and never removes it.',
    'Every tier card lists exactly what it unlocks, including the daily VTX AI message allowance, the number of price alerts and connected wallets, the swap experience (standard fee on lower tiers, gasless EVM swaps on Pro and above), and access to intelligence tools like the whale tracker, DNA Analyzer, smart money tracking, wallet clusters, and the bubble map.',
    'Your active plan is read from your signed-in account using the effective tier, which honors any expiry date on a paid plan, so the card that genuinely applies to you carries a "Current" badge and its button is locked to "Current Plan".',
    'The Pro card is flagged "Most Popular" because it is the point where the full intelligence and trading suite unlocks, while Max sits at the top by adding the Sniper Bot, real-time sniper alerts, advanced sniper configuration, and unlimited connected wallets.',
    'Below the monthly tiers, the Founder Pass is presented as an NFT key you hold rather than a subscription you pay: connecting the wallet that holds it unlocks the Max tier automatically for six months, detected straight from your wallet with no separate sign-up.',
    'An "All plans include" panel spells out the baseline every tier shares, namely the non-custodial wallet, real-time market data, a mobile-optimized interface, multi-chain support, email support, and automatic security scanning.',
    'Crypto payment processing is still being finalized, so the upgrade buttons currently register your interest and point you to the waitlist rather than charging a card on the spot.',
  ],
  howToUse: [
    'Open Pricing from the dashboard to see all four tiers laid out together, with your current plan already marked so you know your starting point.',
    'Read down each feature list and identify the lowest tier that still covers everything you need, whether that is more daily AI messages, more price alerts, or more connected wallets.',
    'Decide where the value lines up: choose Mini for full multi-chain wallet intelligence and the DNA Analyzer, Pro for gasless EVM swaps, copy trading, smart money tracking, and clusters, or Max if you want the Sniper Bot and its real-time alerts.',
    'Press the "Get" button on the plan you want to register your interest while crypto payments are being completed, then watch for the waitlist follow-up.',
    'If you would rather not subscribe, scroll to the Founder Pass and review what it unlocks, then connect the wallet that holds the pass so the platform reads it and switches you to Max for six months.',
    'Check the "All plans include" panel to confirm the essentials you keep on every tier before you commit to any upgrade.',
  ],
  why: [
    'Transparent tiers let you start completely free and pay only for the capabilities you actually use, then step up cleanly as your trading and research deepen without ever losing what you already had.',
    'Because limits on messages, alerts, and connected wallets are stated up front, you size your plan against real usage instead of guessing, which keeps the decision honest and reversible.',
    'The Founder Pass turns an on-chain asset into platform access, so for holders the simple act of keeping the key in a connected wallet is enough to run on the full Max toolkit.',
    'Reach for this page whenever a feature you want sits behind a higher tier, so you can see precisely which plan unlocks it and how that fits the rest of your workflow.',
  ],
  whatsNew: [
    { date: '2026', tag: 'NEW', text: 'The Founder Pass now unlocks the Max tier for six months automatically when you connect the wallet that holds it, with no subscription required during that window.' },
    { date: '2026', tag: 'IMPROVED', text: 'The page now reads your effective tier, so an expired paid plan is reflected correctly and the "Current" badge always lands on the plan that truly applies to you.' },
    { date: '2026', tag: 'IMPROVED', text: 'Plans are presented as four clear tiers (Free, Mini, Pro, and Max) with itemized feature lists and a shared "All plans include" baseline for easy comparison.' },
  ],
};
