import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const securityCenterHowItWorks: HowItWorksContent = {
  title: 'Security Center',
  tagline: 'Your at-a-glance safety dashboard and on-demand contract scanner for any token before you trade.',
  howItWorks: [
    'A Security Health score sits at the top, combining your wallet reputation, risky token approvals, recent threat alerts, and any honeypots you hold into one number you can track over time.',
    'The token scanner pulls live contract data from on-chain security providers (GoPlus on EVM chains, Birdeye on Solana) plus DexScreener market data, then computes a trust score and a SAFE, CAUTION, WARNING, or DANGER rating.',
    'Each scan runs a full checklist: honeypot detection, buy and sell taxes, mint authority, hidden owners, ownership reclaim risk, open-source status, holder count, and liquidity.',
    'An AI assessment reads only the real scan results and writes a plain-language summary, the specific risks it found, and a clear verdict, with no invented numbers.',
  ],
  howToUse: [
    'Open the Security Center to see your composite Security Health score and its reputation, approvals, threats, and honeypots breakdown.',
    'Pick the chain you want to scan from the row of networks, covering Ethereum, BSC, Polygon, Solana, Base, Avalanche, and Arbitrum.',
    'Paste a token contract address into the scan field and press Scan. The tool accepts contracts only, and points wallet addresses to the DNA Analyzer instead.',
    'Read the trust score, security checks, contract details, and market data, then review the AI assessment and its specific warnings.',
    'Open the contract on the block explorer or DexScreener to verify anything yourself before you decide to trade.',
  ],
  why: [
    'Most rugs and honeypots are visible in the contract before the first trade, so a fast scan turns a hidden risk into a clear yes or no.',
    'One health score keeps your overall exposure in view, so you notice risky approvals or flagged holdings instead of forgetting about them.',
    'Real provider data and a grounded AI verdict let you size positions with confidence rather than guessing.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Scan any token across seven chains for honeypots, taxes, and ownership risk, with a composite Security Health score and an AI verdict on every result.',
    },
  ],
};
