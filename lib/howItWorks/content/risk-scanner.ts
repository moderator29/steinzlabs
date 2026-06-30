import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const riskScannerHowItWorks: HowItWorksContent = {
  title: 'Risk Scanner',
  tagline: 'Scan any wallet for on-chain portfolio risk and get a clear score with the reasons behind it.',
  howItWorks: [
    'Risk Scanner reads a wallet\'s real holdings and total value from on-chain data, then scores its portfolio risk from 0 to 100.',
    'The score comes from transparent checks on the live positions: how concentrated the wallet is in a single asset, how many tokens carry no market value, whether it holds a stablecoin buffer, and how diversified it is overall.',
    'Each check shows up as its own card with a High, Medium, or Low rating and a short reason, so you can see exactly what is driving the result.',
    'An AI Intelligence Report then turns the same on-chain data into a written assessment with specific, prioritized recommendations.',
  ],
  howToUse: [
    'Open Risk Scanner and paste any wallet address, or leave it blank to scan your connected wallet.',
    'Tap Run Full Scan and wait while the wallet\'s holdings are read and scored.',
    'Review the overall score and the per-category risk cards to see where the exposure sits.',
    'Read the Intelligence Report for a written summary and the recommendations on what to adjust.',
    'Tap Scan Again to check another address whenever you like.',
  ],
  why: [
    'A single score plus the reasons behind it tells you in seconds whether a wallet is balanced or dangerously exposed.',
    'The risk checks run on real positions, not guesswork, so concentration and unknown-token exposure surface before they cost you.',
    'Scanning any address, not just your own, lets you vet a wallet before you copy it, fund it, or trust it.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'The risk score is computed from transparent checks on real on-chain holdings, paired with an AI Intelligence Report and clear recommendations.',
    },
  ],
};
