import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const walletIntelligenceHowItWorks: HowItWorksContent = {
  title: 'Wallet Intelligence',
  tagline: 'Paste any wallet or token address and get a full on-chain readout in seconds.',
  howItWorks: [
    'In Wallet mode it pulls live on-chain data for any EVM or Solana address: priced holdings, transaction count, recent transfers, and the tokens it actually holds, then runs an AI pass that grades the portfolio and classifies the wallet as retail, smart money, whale, bot, or dormant.',
    'It surfaces patterns from real transaction history: a multi-chain net worth figure across the six supported EVM chains, a UTC activity heatmap of when the wallet trades, top counterparties split by inbound and outbound flow, and 90-day realized PnL on a FIFO cost basis with best and worst closed trades.',
    'Per-holding security is checked so risky bags are flagged: honeypot and trust-level warnings appear right next to each token, sourced from on-chain contract analysis.',
    'In Contract mode it scans a token address for safety signals like buy and sell tax, mintability, hidden owner, honeypot status, holder count, and live DEX price and liquidity.',
  ],
  howToUse: [
    'Open Wallet Intelligence and choose the Wallet or Contract tab.',
    'Pick a chain or leave Auto Detect, which reads the address format for you.',
    'Paste the wallet or token address and tap Scan.',
    'Review the balance, holdings, heatmap, counterparties, and AI grade as each section loads.',
    'Tap Compare to put two wallets side by side, or open any address in its block explorer.',
  ],
  why: [
    'One lookup replaces hopping between explorers, security scanners, and PnL tools, so you can size up a wallet or token before you act.',
    'Every number is grounded in real on-chain data, with risky tokens flagged and empty sections hidden rather than filled with guesses.',
  ],
  whatsNew: [
    { date: 'June 2026', tag: 'NEW', text: 'Realized PnL now highlights the single most profitable and most painful closed trade, with an honest "None in window" when there are no losers.' },
    { date: 'June 2026', tag: 'NEW', text: 'Added a multi-chain net worth figure across all six EVM chains and a UTC activity heatmap that shows when a wallet trades.' },
    { date: 'June 2026', tag: 'NEW', text: 'Top counterparties now show who a wallet trades with most, tagging known exchange, DEX, bridge, and mixer addresses.' },
  ],
};
