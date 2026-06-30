import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const swapHowItWorks: HowItWorksContent = {
  title: 'Swap',
  tagline: 'Trade tokens across seven chains at the best available route, with security checks before you sign.',
  howItWorks: [
    'Swap lets you trade tokens across Ethereum, Base, Solana, BSC, Polygon, Avalanche, and Arbitrum, each routed through that network’s leading venue such as Uniswap V3, Aerodrome, Raydium, or PancakeSwap.',
    'When you enter an amount, the page fetches a live quote and shows the rate, estimated USD value, price impact, slippage, minimum received, network fee, and the routing DEX, with token logos and prices sourced from CoinGecko and the platform’s own price feed.',
    'In the review step the quote is re-priced across multiple aggregators in parallel through 1inch, KyberSwap, and OpenOcean, and the route with the best net output in USD is surfaced so you can compare providers before committing.',
    'A quote freshness badge counts down and the rate auto-refreshes every fifteen seconds while the review modal is open, so the price you sign against is never stale, and a route preview breaks down which protocols and hops your trade actually flows through.',
    'Before you confirm, Swap runs a GoPlus security scan on the destination token and reads back a structured safety summary covering honeypot detection, buy and sell taxes, pausable transfers, and blacklist flags, while a Dune-backed intelligence strip adds sandwich risk, smart-money direction, liquidity context, and a recommended slippage.',
    'Honeypots, taxes at or above thirty percent, pausable or blacklisting contracts, and price impact at or above fifteen percent hard-block the trade, while moderate taxes, wide slippage, and elevated impact raise warnings you can read before deciding.',
    'Execution runs through your connected wallet, and on supported EVM tokens you can opt into gasless mode where the cost is absorbed into the trade, or enable MEV protection to route the swap through a private mempool such as Flashbots or Jito to deter sandwich bots.',
  ],
  howToUse: [
    'Open Swap and choose your network from the selector at the top, which sets the routing venue and the native token for that chain.',
    'Connect the built-in Naka Wallet, or link an external wallet such as MetaMask or Phantom through WalletConnect, and your token balances load automatically.',
    'Pick the token you pay with and the token you want, searching the curated list or pasting a contract address to import and trade an arbitrary token on that chain, then enter an amount or tap MAX or HALF.',
    'Open Settings to set your slippage tolerance from the presets or a custom value, and toggle MEV protection, which auto-enables on Solana and for larger trades.',
    'Expand the details row to read the rate, price impact, minimum received, network fee, and route, and on EVM chains decide whether to keep gasless mode on.',
    'Tap Swap to open the review modal, compare aggregator routes, check the security panel and intelligence strip, and watch the quote refresh countdown.',
    'Clear any warnings, confirm to sign and send, then follow the transaction status and open the explorer link to verify it on-chain.',
  ],
  why: [
    'Comparing aggregator routes for you means you capture a competitive price across 1inch, KyberSwap, and OpenOcean without checking each venue by hand, and the auto-refreshing quote keeps you from signing a rate that has already moved.',
    'The pre-sign GoPlus scan, sandwich-risk score, and hard blocks on honeypots and extreme price impact help you avoid malicious or illiquid tokens before funds ever leave your wallet, which is exactly when you most want to reach for it.',
    'Gasless execution and private-mempool MEV protection bring execution quality that usually lives in standalone trading bots into one clean flow, so research and execution stay in the same place.',
    'Because it covers seven chains with token import and an advanced order panel, Swap fits naturally at the end of a research or alert-driven workflow when you are ready to act on a token you just found.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'The review step now compares routes across 1inch, KyberSwap, and OpenOcean in parallel and highlights the provider with the best net output in USD before you sign.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'A pre-sign GoPlus security scan and a Dune-backed intelligence strip surface honeypot, tax, sandwich-risk, and liquidity signals, and trades with extreme price impact or dangerous token flags are now hard-blocked.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Quotes auto-refresh every fifteen seconds with a live freshness countdown, and MEV protection can route swaps through a private mempool, auto-enabling on Solana and for larger trades.',
    },
  ],
};
