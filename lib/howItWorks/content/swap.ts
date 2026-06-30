import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const swapHowItWorks: HowItWorksContent = {
  title: 'Swap',
  tagline: 'Trade tokens across seven chains at the best available route, with security checks before you sign.',
  howItWorks: [
    'You pick a network, the token you pay with, and the token you want. Swap fetches a live quote and shows the rate, price impact, minimum received, network fee, and routing DEX.',
    'Quotes fan out across multiple aggregators in parallel and surface the route with the best net output. The rate auto-refreshes every few seconds while you review, so you always sign against a fresh price.',
    'Before the final confirmation, Swap runs a security scan on the destination token. Honeypots, high taxes, and pausable or blacklisting contracts are flagged, and the riskiest tokens require an explicit acknowledgement.',
    'Swaps execute through your connected wallet: the built-in Naka Wallet, or any external wallet via WalletConnect. On supported EVM tokens you can opt into gasless mode, and MEV protection can route the trade through a private mempool.',
  ],
  howToUse: [
    'Open Swap and choose your network from the selector at the top.',
    'Connect the Naka Wallet or link an external wallet through WalletConnect.',
    'Pick the token you pay with and the token you want, then enter an amount or tap MAX or HALF.',
    'Open Settings to set slippage tolerance and toggle MEV protection, then review the route, price impact, and minimum received.',
    'Tap Swap, clear any security warnings, and confirm to sign and send the transaction.',
  ],
  why: [
    'Comparing aggregator routes for you means you get a competitive price without checking each DEX by hand.',
    'The pre-sign security scan and risk gate help you avoid honeypots and malicious tokens before funds leave your wallet.',
    'Gasless mode and MEV protection bring execution quality that usually lives in standalone trading bots into one clean flow.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Swap compares routes across multiple aggregators, scans the destination token for risk before you sign, and supports gasless and MEV-protected execution across seven chains.',
    },
  ],
};
