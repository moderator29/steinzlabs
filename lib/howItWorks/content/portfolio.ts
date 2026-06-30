import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const portfolioHowItWorks: HowItWorksContent = {
  title: 'Portfolio',
  tagline: 'See everything your wallet holds, priced live, with allocation, risk, and realized profit in one view.',
  howItWorks: [
    'Portfolio reads your connected wallet on-chain, then prices every token live so your total value, balances, and 24h moves stay current without a refresh.',
    'An allocation donut breaks down where your value sits, and a holdings health panel flags any token whose security score drops below a safe threshold.',
    'The performance section reads your real trade history to compute realized profit and loss using FIFO cost basis, then derives win rate, average hold time, best and worst tokens, and total gas spent.',
    'The value chart plots cumulative capital flow over time, where buys add and cashing out to stablecoins draws down, so it reflects deployed capital rather than mark-to-market value.',
  ],
  howToUse: [
    'Open Portfolio with a wallet connected to load your live holdings and total value.',
    'Use the timeframe pills above the chart to view your capital flow over 1D, 7D, 30D, 90D, or all time.',
    'Switch to the Holdings tab to sort by value, balance, price, or 24h change, and keep suspected spam tokens hidden by default.',
    'Open the Performance tab to read your realized profit and loss, win rate, best and worst tokens, and gas spend.',
    'Tap any holding to jump straight to its market page and trade it.',
  ],
  why: [
    'One screen answers what you hold, what it is worth now, and how your closed trades have actually performed.',
    'Live pricing, allocation, and security flags surface concentration and risk early, so you can rebalance before it bites.',
    'Realized profit and loss is grounded in your real on-chain trade history, not estimates, so the numbers reflect what you genuinely made.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'The performance view surfaces your best and worst tokens by realized profit and loss, alongside win rate, average hold time, and total gas spent across your closed trades.',
    },
  ],
};
