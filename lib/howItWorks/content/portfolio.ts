import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const portfolioHowItWorks: HowItWorksContent = {
  title: 'Portfolio',
  tagline: 'See everything your wallet holds, priced live, with allocation, risk, and realized profit in one view.',
  howItWorks: [
    'Portfolio reads your connected wallet directly on-chain, then prices every token live so your total value, balances, 24h moves, and per token allocation all stay current without a manual refresh.',
    'Holdings come from the platform wallet intelligence pipeline: on EVM chains balances and transactions are fetched from Alchemy with DexScreener and CoinGecko prices and a Zerion fallback, while Solana balances and activity come from Alchemy Solana with Birdeye pricing and DexScreener logos.',
    'A live pricing service backed by CoinGecko re-quotes your tokens roughly every thirty seconds, keying each one by its contract address or, for natives like ETH and SOL, by symbol, so the figures you see reflect the market right now rather than a stale snapshot.',
    'The hero shows your total portfolio value, a today flow figure, and all-time realized profit and loss, while the chart underneath plots cumulative capital flow over time where buys add and cashing out to stablecoins draws down, so it tracks deployed capital rather than mark-to-market value.',
    'The allocation donut ranks your largest positions and folds everything past the top seven into an Other slice, and the holdings health panel runs GoPlus security scans on your top tokens and flags any holding whose score falls below fifty.',
    'The Performance tab reads your authoritative on-chain trade history and applies FIFO cost basis per chain and symbol to compute realized profit and loss, win rate, closed and total trade counts, average hold time, your best and worst tokens, and total gas spent.',
    'In the Holdings table each row shows the token, balance, current price, 24h change, USD value, and an allocation bar, and you can read price as value divided by balance and allocation as that position measured against your total.',
  ],
  howToUse: [
    'Open Portfolio with a wallet connected so it can load your live holdings, total value, and trade history; if no wallet is linked you will see a prompt to connect one or make your first trade.',
    'Read the hero for your total value, today flow, and all-time realized profit and loss, keeping in mind the chart below it tracks capital deployed rather than mark-to-market gains.',
    'Use the timeframe pills above the chart to switch your capital flow view between 1D, 7D, 30D, 90D, and all time.',
    'Scan the allocation donut to see where your value is concentrated, and check the holdings health panel for any token flagged with a security score below fifty.',
    'Switch to the Holdings tab and sort by value, balance, price, or 24h change by clicking a column header, and leave the suspected spam filter on to hide low scoring clutter or untick it to reveal everything.',
    'Open the Performance tab to review your win rate, closed and total trades, average hold time, best and worst tokens by realized profit and loss, and total gas spent.',
    'Click any holding to jump straight to its market page, where you can study it in depth and trade it.',
  ],
  why: [
    'One screen answers the three questions that matter most: what you hold, what it is worth right now, and how your closed trades have actually performed, so you do not have to stitch the picture together from a block explorer and a spreadsheet.',
    'Live pricing, the allocation donut, and security flags surface concentration and risk early, which is exactly when you want to spot an oversized position or a token that has turned dangerous, before it costs you.',
    'Realized profit and loss is grounded in your real on-chain trade history and FIFO cost basis rather than estimates, so win rate, best and worst tokens, and gas spend reflect what you genuinely made and what it cost to get there.',
    'Reach for Portfolio at the start of a session to take stock, after a run of trades to confirm the numbers, or whenever you are deciding what to rebalance, trim, or hold.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'The Performance tab now highlights your single most profitable and most painful closed positions alongside win rate, average hold time, and total gas spent across your closed trades.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Realized profit and loss now keeps a separate FIFO cost basis per chain and symbol, so bridged twins like USDC on Ethereum and USDC on Solana no longer blend into one inaccurate figure.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The value chart is now labeled as cumulative capital flow rather than mark-to-market profit, making clear that buys add and stablecoin exits draw down so the line reflects deployed capital honestly.',
    },
  ],
};
