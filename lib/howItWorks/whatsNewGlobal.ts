import type { WhatsNewEntry } from '@/lib/howItWorks/types';

/**
 * Platform-wide "What's new" log shown from the side navigation. Most recent
 * first. Entries are grounded in the real changelog and describe only what a
 * normal user can see and do. Keep copy free of dash punctuation.
 */
export const GLOBAL_WHATS_NEW: WhatsNewEntry[] = [
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'The Wire goes full SocialFi: cashtags like $SOL and $BTC become live price chips anyone can tap, on-chain tips and gifts land on any wire with the earned value shown on the post, and a transparent 0 to 100 Signal score ranks the feed on real activity.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Inline predictions on The Wire let you attach a call, for example SOL below a target within the hour, that others tap to agree with, tied into Naka Predict.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'The Wire adds Latest, Signal and Pack feeds with auto-applying topic filters, relay reposts, side-panel reply threads, public share links you can post anywhere, and Posts, Replies, Media, Reposts and Gifts tabs on every profile.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'The Wire is your X style timeline: post to the whole platform, add hashtags people can tap and follow, let AI draft or sharpen a post before you send, and gift crypto straight onto any post you rate.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Naka News now runs as a live feed you can vote bullish or bearish on, with a read more link that opens the full story, so you can read the room and dig in without leaving the app.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'A new Stocks tab sits next to your crypto markets, and the premium Market board adds a live heatmap and sector breakdowns so you can see what is green, what is red, and which sectors are moving at a glance.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'A real Prediction board brings live Polymarket markets into the app, so you can see current odds on the events people are betting on and follow how they shift.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Robinhood Chain is fully supported with a guided bridge that walks you through moving funds onto it step by step, so getting your assets across is simple.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Posts now carry multiple images, so you can share a full set of charts or screenshots in one go instead of being limited to a single picture.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Cleaner email and Telegram notifications that read clearly and tell you exactly what happened and what to do next.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Feed is here: a social feed on your dashboard where you post text, one image and a few topic tags, follow the people you rate, and switch between a trending Signal view and a Pack view of who you follow.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Gifting lets you send real crypto straight from your wallet to anyone on a post or profile, non-custodially, across Ethereum, Base, BNB Chain, Robinhood Chain and Solana, so a good call can be rewarded on the spot.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'News now tags every headline bullish or bearish and shows a live market mood banner, and a bell toggle opts you into a twice-daily crypto news digest on Telegram or email.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'The Markets tab adds a real-world-asset board with equities and commodities quotes in a familiar iOS Stocks style, right beside your crypto markets.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Robinhood Chain is now supported, so you can hold, send and gift native ETH on it non-custodially, with in-app swap routing on the way as aggregators list the network.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Safer trading: Swap now blocks known honeypot and high risk tokens before you sign, and refuses trades from sanctioned wallets, so a dangerous token cannot be bought by mistake.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Stronger wallet security: your sniper signing key is now encrypted on your device instead of stored in the clear, and sign in no longer keeps a copy of your session token in the browser.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'Portfolio and wallet balances now value every token correctly, including stablecoins and wrapped coins, so your total net worth reads true.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'Copy trading and sniper now record each trade exactly once, so your realized profit and loss and win rate are accurate.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Real data only: trending, holder counts, token cards and charts now show live figures or an honest blank, never a placeholder or filler value.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Mobile polish: trade and wallet pop ups now fit the screen so the confirm button is always in reach, even with the keyboard open.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Account hardening across sign in, profiles, alerts and admin tools to keep your account and your data safe.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Live token terminal: every coin now opens a real time stats panel (price, liquidity, FDV, market cap, buys and sells) that refreshes every few seconds from live DEX data.',
  },
  {
    date: 'July 2026',
    tag: 'NEW',
    text: 'Market search now finds any of thousands of coins by name, symbol, or contract address, with accurate live data.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'AI Scanner runs deeper multi source security checks (honeypot, taxes, mint authority, liquidity locks, holder concentration) and shows exactly why it rated a token.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'VTX Agent no longer stalls on some tokens and now sources coin data live from DEX pairs, so its numbers match the price cards across the app.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Whale Tracker now leads with the biggest wallets by real held portfolio value.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Portfolio and Wallet now show a real combined balance across every chain, and long tail tokens price correctly instead of reading zero.',
  },
  {
    date: 'July 2026',
    tag: 'FIXED',
    text: 'Swap now shows a real price impact and network fee instead of a flat zero.',
  },
  {
    date: 'July 2026',
    tag: 'IMPROVED',
    text: 'Tightened account security so nothing from one account can appear after signing into another on a shared device.',
  },
  {
    date: 'June 2026',
    tag: 'NEW',
    text: 'Daily Research Brief: an automated daily market read now lands in Research Labs and, if you want it, your inbox.',
  },
  {
    date: 'June 2026',
    tag: 'NEW',
    text: 'Whale Tracker streams a live, dollar-priced feed across every chain, covering both received and sent moves.',
  },
  {
    date: 'June 2026',
    tag: 'IMPROVED',
    text: 'Wallet Intelligence added best and worst realized trades, an activity heatmap, multi-chain net worth, and top counterparties.',
  },
  {
    date: 'June 2026',
    tag: 'IMPROVED',
    text: 'Research Labs now opens a full detail page for every brief, with cover, category, read time, and a live view count.',
  },
  {
    date: 'June 2026',
    tag: 'FIXED',
    text: 'Market and feed surfaces now report only real trade data and show an honest idle state when a tape is quiet.',
  },
  {
    date: 'June 2026',
    tag: 'IMPROVED',
    text: 'Direct messages and live feeds update in real time without a reload, and unread counts clear as soon as you read.',
  },
];
