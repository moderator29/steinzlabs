import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const dashboardHowItWorks: HowItWorksContent = {
  title: 'Dashboard',
  tagline: 'Your live home base for the market and your own activity in one screen.',
  howItWorks: [
    'The Dashboard is the home screen you land on after signing in, and it opens with four live stat cards covering total market cap, 24h volume, BTC dominance, and the number of active coins, all pulled from the CoinGecko global feed and refreshed about every two minutes so the figures track the current market rather than a stored snapshot.',
    'Directly below the stats sit two market panels: Top Gainers ranks the strongest 24h movers with price, percentage change, and a seven-day sparkline, while Heating Up surfaces the coins climbing fastest in global CoinGecko search velocity, each row linking straight through to that token\'s detail page.',
    'A three-way toggle under the panels switches the main area between Overview, Context Feed, and Market, so the same screen can show your personal activity, a stream of on-chain signals, or a broader market view without leaving the page.',
    'Overview is built from reorderable widgets: a portfolio hero with total balance and 24h change, a "since last login" digest of new alerts and watchlist movers, and a personalised home block with quick actions plus your watchlist, triggered alerts, and the smart-money wallets you follow.',
    'The Context Feed streams on-chain signals in real time and can be narrowed by chain across Solana, Ethereum, BSC, Polygon, Avalanche, Base, Arbitrum, and Optimism, with Bookmarks and Archive tabs for saved items and an AI Market Pulse summary at the top.',
    'Widgets that have nothing to show hide themselves, so the portfolio hero stays out of the way until you connect a wallet and the digest only appears once you have a prior session on record, keeping a fresh account clean instead of padded with empty cards.',
    'A green LIVE indicator in the header confirms the feeds are streaming, and any panel that loses its upstream data shows an honest empty state rather than fabricated numbers.',
  ],
  howToUse: [
    'Start by scanning the four stat cards and the Top Gainers and Heating Up panels at the top for a fast read on where the broad market and the hottest tokens are sitting right now.',
    'Tap any row in either market panel to open that token\'s detail page when something catches your eye and you want to dig deeper.',
    'Use the Overview, Context Feed, and Market toggle to choose what the main area shows: your own activity, the live signal stream, or the wider market view.',
    'On Overview, work through the widgets to check your portfolio balance, review what changed since your last visit, and use the quick actions to swap, send, track a wallet, or set an alert.',
    'Press the Customise button above the widgets to drag them into the order you prefer, and that arrangement is saved to your account so the home screen leads with the cards you care about most.',
    'Open the Context Feed and pick a chain tab to focus the stream, then bookmark the signals worth keeping or send the older ones to Archive.',
    'Use the bottom menu to jump to Find, VTX Agent, Wallet, and Profile, and open the side menu from the top-left icon to reach every other feature on the platform.',
  ],
  why: [
    'One screen gives you both the market pulse and your own positions, alerts, and followed wallets, so every session starts with full context instead of a cold open.',
    'Reach for the Dashboard first thing each day to see what moved overnight, then drill into the gainers, trending tokens, or signals that matter before committing to a trade.',
    'Because the layout is yours to reorder and the widgets hide what is irrelevant, the home screen adapts to how you actually work rather than forcing one fixed view on everyone.',
    'It sits at the centre of a research and trading workflow, routing you out to token detail pages, the wallet tools, alerts, and the VTX Agent without losing the live read you opened with.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The Overview now follows your saved widget order, so the home screen leads with the cards you care about most.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The Heating Up panel now refreshes about once a minute so its search-trending coins stay meaningful instead of going stale.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Top Gainers and Heating Up panels bring a live market overview straight to the home screen.',
    },
  ],
};
