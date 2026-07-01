import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const sniperHowItWorks: HowItWorksContent = {
  title: 'Sniper Bot',
  tagline: 'Non-custodial sniping that scans fresh launches and executes your rules from your own wallet.',
  howItWorks: [
    'The Discover feed streams newly created pairs across Solana and the major EVM chains and launchpads, served from the platform\'s own launch index and refreshed about every twenty seconds so fresh tokens surface without a manual reload.',
    'Each token carries live market data pulled from DexScreener and the platform feeds (price, liquidity, 24h volume, market cap, transaction count, holders, and bonding curve progress) plus an on-chain security read from GoPlus that flags honeypots and reports buy and sell tax, holder spread, and a security score.',
    'Card status reflects that screening directly: a high security score reads as safe, a middling score reads as risky, and a confirmed honeypot is blocked, so you can judge a launch at a glance before committing capital.',
    'Snipers are reusable rules you define: pick the trigger (a new pair, a dev or whale wallet you want to mirror, or a price target), the EVM chains, the amount per buy, slippage and priority fee, daily caps, MEV protection, and optional take-profit, stop-loss, and trailing-stop exits.',
    'When a launch matches a rule the bot executes from your own connected wallet, either your in-app Naka wallet that you confirm with a password sign or an external wallet like MetaMask or Phantom, so private keys never leave your control.',
    'Every fill lands as a live position with realized and unrealized PnL, and the History tab logs each execution with status, amount, fill speed in milliseconds, and a direct link to the transaction on the chain explorer.',
    'The command bar keeps a running tally of active snipers, total executions, aggregate PnL, and average execution speed, and a Kill Switch you operate can halt all of your snipers at once.',
  ],
  howToUse: [
    'Open the Sniper Bot from your dashboard and connect a wallet through the wallet status control so executions can run non-custodially from your own keys.',
    'In the Discover feed, set the chain pills, launchpad source chips, and a minimum liquidity preset, then sort by New, Volume, Liquidity, or Market cap to line up the launches you care about.',
    'Tighten the list with the safety toggles by excluding honeypots, requiring at least one social link, or switching on OG mode to surface the earliest token seen for a ticker, and paste a name, symbol, or contract address into the search box to jump straight to one token.',
    'Open a token card to inspect its security read and market stats, or tap New Sniper to start a rule.',
    'In the rule editor, choose your trigger and wallet source, set the buy amount, slippage, priority fee, and daily snipe and spend caps, then turn on Anti-MEV, take-profit and stop-loss targets, and the safety filters for minimum liquidity, maximum tax, minimum holders, and security score.',
    'Review every value on the confirmation screen, save the rule, and let it watch the chain, or leave Auto-Execute off to receive a one-tap approval instead of an automatic buy.',
    'Track results in the Positions and History tabs as fills arrive, and use the Kill Switch whenever you want to stop all snipers instantly, then resume when you are ready.',
  ],
  why: [
    'New tokens move in seconds, and a rules-based bot acts the moment a launch matches your criteria so you capture early entries without watching feeds around the clock.',
    'Reach for it when you trade fresh launches, mirror a dev or whale wallet, or want a buy staged at a specific price, and let the safety filters and GoPlus screening keep obvious honeypots and high-tax traps out of your fills.',
    'Trades run from your own wallet with MEV-aware routing and capped daily spend, so you stay in control of risk while the bot handles the speed.',
    'Live positions, realized PnL, and per-fill execution timing give you an honest record of how every snipe performed, which feeds straight back into refining your rules and the rest of your trading workflow.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The Discover feed gained OG mode, launchpad source chips, honeypot and social safety toggles, multi-chain sorting, and optional sound alerts for fresh pairs and bonding curve graduations.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Rules now support new pair, dev or whale mirror, and price target triggers with take-profit, stop-loss, trailing-stop, and auto-sell exits alongside safety filters for liquidity, tax, holders, and security score.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Sniper Bot ships on the MAX tier with non-custodial EVM execution, a live multi-chain launch feed, GoPlus security screening, MEV protection, and a one-tap Kill Switch.',
    },
  ],
};
