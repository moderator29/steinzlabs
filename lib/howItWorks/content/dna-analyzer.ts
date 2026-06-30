import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const dnaAnalyzerHowItWorks: HowItWorksContent = {
  title: 'DNA Analyzer',
  tagline: 'Decode any wallet into a full on-chain profile, from trading style to portfolio quality.',
  howItWorks: [
    'You enter any EVM or Solana wallet address, and the analyzer pulls its real holdings, balances, transaction history, and activity span from on-chain data providers.',
    'A rule-based engine reads those signals to assign a behavioral archetype, such as Diamond Hands, Scalper, Degen, or Whale Follower, based on how often and what the wallet actually trades.',
    'Naka Intelligence then writes a qualitative read of the wallet: personality profile, strengths, weaknesses, recommendations, and a market outlook grounded strictly in the holdings and activity shown.',
    'The portfolio score and letter grade come from a transparent formula over diversification, blue chip quality, holdings breadth, and activity, so the numbers stay consistent rather than guessed.',
  ],
  howToUse: [
    'Open the DNA Analyzer from your dashboard.',
    'Connect your wallet to analyze your own DNA, or paste any wallet address into the input field.',
    'Tap Analyze DNA and let the scan fetch balances, parse history, and run the intelligence pass.',
    'Review the identity profile, trading archetype, AI insights, and sector breakdown in the results.',
    'Use Quick Actions to copy the address, track the wallet in Alerts, or analyze another wallet next.',
  ],
  why: [
    'It turns a raw address into an instant, readable profile, so you can judge a wallet before you follow or copy it.',
    'Every number is grounded in real on-chain data or a published formula, never an invented win rate or fabricated PnL.',
    'It surfaces coins worth watching that fit the wallet\'s style, giving you a research lead beyond what it already holds.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'DNA Analyzer profiles any EVM or Solana wallet with a behavioral archetype, a grounded portfolio grade, and an AI intelligence read of its real holdings and activity.',
    },
  ],
};
