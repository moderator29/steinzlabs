import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const walletHowItWorks: HowItWorksContent = {
  title: 'Wallet',
  tagline: 'A non-custodial multi-chain wallet where your keys stay on your device and your balances stay live.',
  howItWorks: [
    'Naka Wallet is a self-custody wallet: your seed phrase and private keys are encrypted with your password using the browser Web Crypto API and stored only on your device, so the platform never holds your funds and cannot move them.',
    'When you open a wallet, balances and holdings are read live for the active network through the wallet intelligence pipeline, which uses Alchemy for EVM token and native balances and Solana indexers for SOL and SPL tokens, while spot prices and 24h change come from CoinGecko.',
    'The top of the screen shows your total balance for the selected chain with a 24h change pill, your shortened address with one tap copy, and a refresh control that re-reads balances and prices on demand.',
    'The holdings list merges your real on-chain tokens with native-asset placeholders for every network you have enabled and with custom tokens you add, where small-cap contract metadata and logos are resolved through DexScreener when CoinGecko has no listing.',
    'Tabs split your wallet into Holdings, a personal Watchlist, your NFTs across EVM and Solana, and an Activity feed of recent transactions, while a spam filter automatically hides airdropped scam tokens that name themselves with claim or reward style links unless you added the token yourself.',
    'Beyond the main view you can open Portfolio Analytics, which fans the balance fetch across all live networks and breaks your total value down by network and by asset, and an Approvals screen that lists the ERC-20 spending allowances your wallet has granted so you can revoke risky ones.',
    'One seed phrase can back several accounts because new accounts derive from the same phrase at the next account index, and you can also connect a Ledger as a hardware-backed account whose private key never leaves the device.',
  ],
  howToUse: [
    'Open Wallet, then create a new wallet or import an existing one using a seed phrase or a raw private key.',
    'Write down your seed phrase and confirm the backup reminder so you can always recover access, since self-custody means no one can restore it for you.',
    'Use the network selector to choose a chain such as Ethereum, Solana, Polygon, Arbitrum, BNB Chain, or Base, then read your native balance and tokens for that network.',
    'Tap Send, Receive, Swap, or Buy from the four action buttons to move funds, and scan a QR code or paste an address when you need to capture a destination quickly.',
    'Search your assets, sort the list by value, by 24h change, or alphabetically, and toggle Hide small to clear out sub one dollar dust.',
    'Open Add Token to import a contract, where Naka auto-resolves the real name, symbol, and logo and runs a GoPlus security scan on that chain so you can confirm or cancel before saving, and use Add Network to enable more chains or turn on test networks.',
    'Open Wallet settings to rename a wallet, set a default, reveal your seed phrase, add another account from the same seed, or remove a wallet, and open Portfolio Analytics or Approvals for a deeper view of allocation and spending permissions.',
  ],
  why: [
    'You stay fully in control because the wallet is non-custodial, so only you, holding your password and seed phrase, can ever move your funds.',
    'A single place covers dozens of networks, tokens, NFTs, a watchlist, and live pricing, which removes the need to juggle a separate wallet app for each chain.',
    'Portfolio Analytics and the approvals review turn raw balances into a clear read on where your value sits and which contracts can still spend your tokens, which is exactly what you want before sizing a position or cleaning up old permissions.',
    'It sits naturally beside the rest of the platform: Send and Receive deep-link in from coin detail pages, Swap hands off to the swap flow, and your holdings flow into portfolio and research views so funding, trading, and analysis stay in one app.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Add Custom Token now works end to end across chains with a network selector, per-chain validation including case-sensitive Solana addresses, on-chain metadata auto-fill, and a GoPlus security scan run on the selected chain before you save.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Add multiple accounts from one seed phrase so a single backup protects them all, or connect a Ledger as a hardware-backed account whose private key never leaves the device.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'A revoke.cash style Approvals screen lists the ERC-20 spending allowances your wallet has granted on the active chain and lets you revoke any of them by signing with your own key.',
    },
  ],
};
