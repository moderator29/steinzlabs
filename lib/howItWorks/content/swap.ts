import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const swapHowItWorks: HowItWorksContent = {
  title: 'Swap',
  tagline: 'Buy any coin by name or contract across every supported network like a pro DEX, non-custodially, with security checks before you sign.',
  howItWorks: [
    'Swap is a clean two-card trade panel: a You pay card on top and a You receive card below, with a direction switch between them so you can flip the pair in one tap. Every token shows its real logo, so the pair you are trading always looks like the coin it is.',
    'You can buy almost any coin, not just a curated shortlist. Search by name or symbol, or paste a contract address, and Swap finds the token across networks with its real art and live data, the same universal search that powers global search and the markets board.',
    'Swap trades across Ethereum, Base, Solana, BSC, Polygon, Avalanche, and Arbitrum, each routed through that network’s leading venue such as Uniswap V3, Aerodrome, Raydium, or PancakeSwap. NAKA on Ethereum is supported first-class, so you can trade it directly.',
    'When you enter an amount, the page fetches a live quote and shows the rate, estimated USD value, price impact, slippage, minimum received, network fee, and the routing DEX, with token logos and prices sourced from CoinGecko and the platform’s own price feed.',
    'In the review step the quote is re-priced across multiple aggregators in parallel through 1inch, KyberSwap, and OpenOcean, and the route with the best net output in USD is surfaced so you can compare providers before committing.',
    'A quote freshness badge counts down and the rate auto-refreshes every fifteen seconds while the review modal is open, so the price you sign against is never stale, and a route preview breaks down which protocols and hops your trade actually flows through.',
    'Before you confirm, Swap runs a GoPlus security scan on the destination token and reads back a structured safety summary covering honeypot detection, buy and sell taxes, pausable transfers, and blacklist flags, while a Dune-backed intelligence strip adds sandwich risk, smart-money direction, liquidity context, and a recommended slippage.',
    'Honeypots, taxes at or above thirty percent, pausable or blacklisting contracts, and price impact at or above fifteen percent hard-block the trade, while moderate taxes, wide slippage, and elevated impact raise warnings you can read before deciding.',
    'Execution is non-custodial and runs through whichever wallet you connect: the built-in Naka Wallet, an injected browser extension, or WalletConnect including mobile wallets. On supported EVM tokens you can opt into gasless mode where the cost is absorbed into the trade, or enable MEV protection to route the swap through a private mempool such as Flashbots or Jito to deter sandwich bots. A small platform fee is included in the quote before you sign.',
    'When the trade settles, Swap shows a branded, shareable receipt with the pair, amounts, USD values, chain and transaction hash, which you can share natively or save as a PNG. The same card appears if a swap fails, and it says plainly that your balance did not change, so success and failure are both honest and easy to pass on.',
  ],
  howToUse: [
    'Open Swap and choose your network from the selector at the top, which sets the routing venue and the native token for that chain.',
    'Connect the built-in Naka Wallet, an injected extension like MetaMask or Phantom, or a mobile wallet through WalletConnect, and your token balances load automatically.',
    'Set the token you pay with and the coin you want by searching any name or symbol or pasting a contract address, use the direction switch to flip the pair if you need to, then enter an amount or tap MAX or HALF.',
    'Open Settings to set your slippage tolerance from the presets or a custom value, and toggle MEV protection, which auto-enables on Solana and for larger trades.',
    'Expand the details row to read the rate, price impact, minimum received, network fee, and route, and on EVM chains decide whether to keep gasless mode on.',
    'Tap Swap to open the review modal, compare aggregator routes, check the security panel and intelligence strip, and watch the quote refresh countdown.',
    'Clear any warnings, confirm to sign and send, then read the branded receipt that appears and share it or save it as a PNG.',
  ],
  why: [
    'Comparing aggregator routes for you means you capture a competitive price across 1inch, KyberSwap, and OpenOcean without checking each venue by hand, and the auto-refreshing quote keeps you from signing a rate that has already moved.',
    'The pre-sign GoPlus scan, sandwich-risk score, and hard blocks on honeypots and extreme price impact help you avoid malicious or illiquid tokens before funds ever leave your wallet, which is exactly when you most want to reach for it.',
    'Gasless execution and private-mempool MEV protection bring execution quality that usually lives in standalone trading bots into one clean flow, so research and execution stay in the same place.',
    'Because you can buy almost any coin by name or contract across every supported network from one panel, Swap fits naturally at the end of a research or alert-driven workflow when you are ready to act on a token you just found.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Swap is rebuilt as a pro DEX: buy almost any coin by name or contract across every supported network, in a two-card You pay and You receive panel with a one-tap direction switch and real token logos.',
    },
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'A branded, shareable receipt shows on every trade, success or failure, with the pair, amounts, chain and hash, ready to share natively or save as a PNG.',
    },
    {
      date: 'July 2026',
      tag: 'IMPROVED',
      text: 'Non-custodial execution now works the same across the built-in Naka Wallet, injected extensions, WalletConnect mobile wallets and gasless mode, and NAKA on Ethereum is tradeable first-class.',
    },
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
