import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const contractAnalyzerHowItWorks: HowItWorksContent = {
  title: 'Contract Analyzer',
  tagline: 'Scan any token or contract address for honeypots, dangerous permissions, and rug risk before you trade.',
  howItWorks: [
    'You paste a contract or token address and pick its chain, and the analyzer queries multiple real providers in parallel for token security, address intelligence, and live market data.',
    'It checks for honeypot behavior, unverified source code, mint and ownership permissions, hidden owners, self destruct calls, and very high buy or sell taxes, then flags addresses tied to phishing, mixing, or blacklists.',
    'A transparent scoring formula turns those signals into a 0 to 100 security score and a clear verdict of Safe, Caution, Warning, or Danger, with a risk breakdown across honeypot, ownership, contract, and tax exposure.',
    'Naka Intelligence adds a short written assessment of the key risks, and related panels surface similar tokens and connected wallets so you can see the wider picture.',
  ],
  howToUse: [
    'Open the Contract Analyzer from your dashboard.',
    'Pick the chain, such as Ethereum, BSC, Base, Arbitrum, or Solana.',
    'Paste the contract or token address into the input field.',
    'Tap Analyze and wait for the honeypot, security, and risk checks to finish.',
    'Review the score, risk flags, security details, and the assessment summary before you act.',
  ],
  why: [
    'It helps you spot honeypots, rug pulls, and dangerous permissions before you commit funds, not after.',
    'Every result is built from real provider data, with a clear no data state when an address is unknown and a too early notice when a token just launched, never a fabricated report.',
    'The score, verdict, and risk breakdown give you a fast, consistent read so you can move quickly while still doing your own research.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'The Contract Analyzer scans tokens across seven chains for honeypots, permissions, and taxes, and pairs a transparent security score with an AI risk assessment and related token and wallet panels.',
    },
  ],
};
