import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const sniperHowItWorks: HowItWorksContent = {
  title: 'Sniper Bot',
  tagline: 'Non-custodial sniping that scans fresh launches and executes your rules from your own wallet.',
  howItWorks: [
    'The Discover feed streams newly launched pairs across Solana and the major EVM chains and launchpads, refreshing live so you see fresh tokens as they appear.',
    'Every token is run through an on-chain security check (honeypot, liquidity, social presence) so risky pairs are flagged and can be filtered out before you act.',
    'You define snipers as reusable rules: which chains, how much per buy, daily caps, slippage, MEV protection, and optional take-profit and stop-loss.',
    'When a launch matches a rule, the bot executes from your own connected wallet, then tracks the fill as a live position with real-time PnL.',
  ],
  howToUse: [
    'Open the Sniper Bot from your dashboard and connect a wallet so executions can run non-custodially.',
    'Use the Discover feed to browse fresh launches, filtering by chain, launchpad, minimum liquidity, or honeypot exclusion.',
    'Tap New Sniper to set your buy amount, daily limits, slippage, MEV protection, and take-profit or stop-loss targets.',
    'Watch the Positions and History tabs as fills land, with live PnL, execution speed, and links to each transaction.',
    'Use the Kill Switch any time to halt all of your snipers instantly, then Resume when you are ready.',
  ],
  why: [
    'New tokens move in seconds, and a rules-based bot acts the moment a launch matches so you are not glued to the screen.',
    'Trades run from your own wallet with MEV-aware routing and built-in security screening, keeping you in control while filtering out obvious traps.',
    'Live positions, realized PnL, and execution timing give you an honest record of how every snipe performed.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Sniper Bot is available on the MAX tier with non-custodial EVM execution, live multi-chain launch discovery, on-chain security screening, MEV protection, and take-profit and stop-loss automation.',
    },
  ],
};
