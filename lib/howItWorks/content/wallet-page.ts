import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const walletHowItWorks: HowItWorksContent = {
  title: 'Wallet',
  tagline: 'A non-custodial multi-chain wallet where your keys stay on your device and your balances stay live.',
  howItWorks: [
    'Your seed phrase and private keys are encrypted with your password using Web Crypto and never leave your device, so Naka never holds your funds.',
    'Balances and token prices are read live across Ethereum, Solana, Polygon, Arbitrum, BNB Chain, Base, and many more networks, with real values pulled from on-chain data and market sources.',
    'One seed phrase can back several accounts: new accounts derive from the same phrase at the next account index, so one backup protects them all.',
    'You can hold many tokens and NFTs, keep a watchlist, review token approvals, and open portfolio analytics, all from a single view.',
  ],
  howToUse: [
    'Open Wallet, then create a new wallet or import an existing one with a seed phrase or private key.',
    'Write down your seed phrase and confirm the backup reminder so you can always recover access.',
    'Pick a network from the chain selector to see your native balance and tokens for that chain.',
    'Tap Send, Receive, or Buy to move funds, and use Add Token or Add Network to expand what you track.',
    'Open Wallet settings any time to rename a wallet, set a default, reveal your seed, or remove an account.',
  ],
  why: [
    'You stay fully in control: this is non-custodial, so only you can move your funds.',
    'One place covers dozens of chains, tokens, NFTs, and a watchlist, so you do not need a separate app per network.',
    'Live pricing and portfolio analytics turn raw balances into a clear picture of what you actually hold.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Add Custom Token now works end to end across chains with per-network validation, including case-sensitive Solana addresses and a security scan on the selected chain.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Multi-chain net worth sums your priced balances across all supported chains into one figure with a per-chain proportion bar.',
    },
  ],
};
