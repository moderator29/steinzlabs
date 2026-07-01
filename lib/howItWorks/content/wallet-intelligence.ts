import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const walletIntelligenceHowItWorks: HowItWorksContent = {
  title: 'Wallet Intelligence',
  tagline: 'Paste any wallet or token address and get a full on-chain readout in seconds.',
  howItWorks: [
    'Wallet Intelligence has two modes that share one search bar: Wallet mode profiles any EVM or Solana address, and Contract mode scans any token contract for safety, while Auto Detect reads the address format so you rarely have to pick a chain yourself.',
    'In Wallet mode the page assembles a live picture from real on-chain feeds: EVM balances and transfers come from Alchemy with CoinGecko pricing, Solana holdings are resolved through Helius metadata, Birdeye prices, and DexScreener token names and logos, and every priced holding is checked against GoPlus contract security so honeypots and risky bags get a label right next to the token instead of being silently dropped.',
    'The header strip summarizes total balance, transaction count, tokens held, and the chain, and for EVM addresses a lazy Multi-Chain Net Worth panel fans the same pipeline across all six supported chains and sums the priced balances into one figure with a per-chain proportion bar.',
    'A Realized PnL card reads ninety days of real DEX trades from Bitquery and computes profit and loss on a FIFO cost basis using each trade value at the time it happened, surfacing win rate, closed lots, average hold time, and the single best and worst token, with an honest "None in window" when there were no losers.',
    'The Activity Heatmap buckets the wallet\'s real transaction timestamps into a seven-day by four-block UTC grid so you can see when it trades, and Top Counterparties tallies who it transacts with most from inbound and outbound flow, tagging known exchange, DEX, bridge, mixer, market maker, and lending addresses from the on-chain entity registry.',
    'A DNA-level AI pass then grades the portfolio, assigns an overall score and trading style, and classifies the wallet as retail, smart money, whale, institutional, bot, or dormant, adding diversification, key insight, strengths and weaknesses, risk assessment, and notable behaviors.',
    'In Contract mode a token address is scanned through GoPlus for buy and sell tax, mintability, hidden owner, proxy status, ownership controls, holder count, and a clear honeypot verdict, alongside live DexScreener price, market cap, fully diluted value, twenty-four hour volume, and liquidity.',
  ],
  howToUse: [
    'Open Wallet Intelligence and choose the Wallet or Contract tab at the top.',
    'In Wallet mode pick a chain from the row or leave Auto Detect, which reads whether the address is EVM or Solana for you.',
    'Paste the wallet address and press Scan, then watch the balance, holdings, multi-chain net worth, realized PnL, heatmap, and counterparties load in sequence.',
    'Read the holdings list with its security labels first, expand it to see every token, and use Show all to step through the full transaction history.',
    'Let the AI section finish to get the overall score, portfolio grade, wallet classification, risk assessment, and recommendations, then open any address in its block explorer to dig deeper.',
    'Use the Compare button in the header to put two wallets side by side, or switch to the Contract tab and paste a token address to check its tax, honeypot status, and live market data before you buy.',
  ],
  why: [
    'One lookup replaces hopping between block explorers, security scanners, and PnL trackers, so you can size up a wallet or a token in a single screen before you copy, follow, or buy.',
    'Because cost basis comes from real trades at the time they happened and security comes from live contract analysis, the realized PnL, counterparties, and risk flags reflect what actually occurred rather than estimates pulled from current prices.',
    'Reach for it when you spot an interesting address in the whale feed or a new token in your watchlist and want a fast read on whether it is smart money, a bot, or a trap.',
    'It fits naturally at the research step of a trading workflow, turning a raw address into a graded profile you can act on, with empty sections hidden rather than padded with guesses.',
  ],
  whatsNew: [
    { date: 'June 2026', tag: 'NEW', text: 'Realized PnL now highlights the single most profitable and most painful closed position, showing a truthful "None in window" in the worst slot when the wallet has no losing tokens.' },
    { date: 'June 2026', tag: 'NEW', text: 'Added a Multi-Chain Net Worth panel that aggregates priced balances across all six supported EVM chains, plus a UTC activity heatmap that shows when a wallet actually trades.' },
    { date: 'June 2026', tag: 'NEW', text: 'Top Counterparties now reveals who a wallet transacts with most, splitting inbound and outbound flow and tagging known exchange, DEX, bridge, and mixer addresses.' },
  ],
};
