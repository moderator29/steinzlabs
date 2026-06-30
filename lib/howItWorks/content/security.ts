import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const securityCenterHowItWorks: HowItWorksContent = {
  title: 'Security Center',
  tagline: 'Your at-a-glance safety dashboard and on-demand contract scanner for any token before you trade.',
  howItWorks: [
    'The Security Center opens with a composite Security Health score, a single number from zero to one hundred that blends four signals: your wallet reputation at fifty percent, open approval risk at twenty percent, recent threat alerts at fifteen percent, and honeypot tokens you currently hold at fifteen percent.',
    'Each of those four parts is shown as its own sub-score in the breakdown grid, colored green, amber, or red, so you can see exactly which area is dragging the headline number down rather than guessing.',
    'Below the health card sits the token scanner, where you choose a network and paste a contract address to run a full security analysis on demand across Ethereum, BSC, Polygon, Solana, Base, Avalanche, and Arbitrum.',
    'On EVM chains the scan reads live contract intelligence from GoPlus, confirms whether the address is a real contract through Alchemy, and pulls market context from DexScreener, while Solana tokens are checked with Birdeye security and overview data alongside the same DexScreener feeds.',
    'The result is summarized as a trust score and a SAFE, CAUTION, WARNING, or DANGER rating, then broken into a security checklist, a contract details panel, and a market data block covering price, twenty four hour change, market cap, volume, liquidity, and fully diluted valuation.',
    'A checklist covers honeypot behavior, buy and sell taxes, mint authority, hidden owners, ownership reclaim risk, proxy upgradeability, open-source status, holder count, and liquidity depth, with each line marked pass, warning, or fail.',
    'An AI assessment then reads only the real scan output and writes a plain-language summary, a list of the specific risks it found, and a one-word verdict, with concrete warnings and recommendations tailored to the rating and no invented figures.',
  ],
  howToUse: [
    'Open the Security Center and read your composite Security Health score, checking the reputation, approvals, threats, and honeypots tiles to see which area needs attention.',
    'If you have not enabled two-factor authentication yet, use the prompt on the health card to add a TOTP step before sensitive actions like wallet export.',
    'Pick the network you want to scan from the row of chains, since the same address can behave differently across Ethereum, BSC, Polygon, Solana, Base, Avalanche, and Arbitrum.',
    'Paste a token contract address into the scan field and press Scan, remembering the tool accepts contracts only and will redirect a wallet address to the DNA Analyzer instead.',
    'Read the trust score ring and rating first, then work down through the security checks, contract details, and market data to understand where the risk sits.',
    'Review the AI security assessment, its specific warnings, and its recommendations, and use the thumbs up or thumbs down control to mark whether the verdict was helpful.',
    'Open the contract on the block explorer or jump to DexScreener from the result to confirm anything yourself before you decide to trade.',
  ],
  why: [
    'Most rugs and honeypots are visible in the contract and its liquidity before the first trade, so a fast scan turns a hidden trap into a clear yes or no and saves you from buying something you cannot sell.',
    'Reach for the scanner whenever a new ticker reaches you from a feed, a chat, or a chart, especially low cap tokens where mint authority, owner balance control, and thin liquidity are the common failure points.',
    'The single Security Health score keeps your overall exposure in view, so risky approvals or flagged holdings surface as a falling number instead of being forgotten across sessions.',
    'Real provider data paired with a grounded AI verdict lets you size positions and set stops with evidence rather than gut feel, which fits cleanly into a research-first trading workflow.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'The AI security assessment now factors in DexScreener market context, including the fully diluted valuation to liquidity ratio, so its summary and verdict catch thin-liquidity exit risk on top of contract flags.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'A composite Security Health score now sits above the scanner, combining wallet reputation, open approval risk, recent threat alerts, and honeypot holdings into one tracked number with a per-component breakdown.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Token scanning expanded to seven networks with native Solana support, using Birdeye for mint authority, freeze authority, LP burn, and top holder concentration alongside GoPlus on the EVM chains.',
    },
  ],
};
