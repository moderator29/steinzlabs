import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const notificationsHowItWorks: HowItWorksContent = {
  title: 'Notifications',
  tagline: 'One place for every alert that matters, from whale moves to price breaks to security flags.',
  howItWorks: [
    'Your notification feed gathers live market signals and your own account events into a single, time-ordered list that the full page and the header bell both read from the same source, so the two never diverge.',
    'Market signals are computed in real time from CoinGecko: price breaks fire when a top token moves more than five percent in an hour, security flags surface when a token crashes sharply or shows an unusually high volume to market cap ratio, whale entries highlight tokens with the heaviest 24 hour volume, and a trending row tracks what is climbing the rankings.',
    'Alerts you set up yourself, such as a triggered whale follow, are written as durable notifications and stored in your account, so they stay in your feed after you reload instead of flashing once and vanishing.',
    'Account activity is captured locally too, including wallet creation and import, completed swaps, sent transactions, and seed backup reminders, all kept in a rolling on-device store that holds your most recent entries.',
    'Each row carries an icon for its category, a clear title, a short message, and a relative timestamp like a few minutes ago, with unread items tinted blue and marked with a dot so you can scan what is new at a glance.',
    'For critical categories like whale and price alerts, the platform can also reach you off the page through email and Telegram when you have those channels enabled, so a key move lands even when the app is closed.',
    'Local entries take priority over the synced copy for the same item, which keeps your read state and your own actions consistent across the bell and the full page.',
  ],
  howToUse: [
    'Open Notifications from the side navigation or tap the header bell to load your full feed.',
    'Scan the list from newest to oldest, where unread rows carry a blue tint and a dot so they stand out from items you have already seen.',
    'Read the icon and title to tell categories apart at a glance, with whale, price, trending, security, swap, send, and system events each rendered distinctly.',
    'Open any notification that links to a destination to jump straight to the related token, wallet, or page and act on the signal.',
    'Watch the header for the unread count and the all caught up state so you always know whether new activity is waiting.',
    'Use Mark all read once you are caught up to clear the unread count across both the page and the bell.',
    'Set up the alerts you care about, like following a whale, so their triggers arrive here as durable entries you can return to.',
  ],
  why: [
    'It keeps every important market and account signal in one feed, so you never miss a move while it is still actionable instead of hunting across separate screens.',
    'Durable alerts mean the events you follow stay available for later review rather than being shown once and lost, which matters when a signal fires while you are away.',
    'Because the same data drives the bell and the full page, the unread count you see is always trustworthy, and clearing it once clears it everywhere.',
    'Reach for it as your first stop after stepping away from the desk, to catch overnight whale activity, sharp price breaks, and risk flags before deciding what to research or trade next.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Triggered whale alerts now write a durable in-app notification, so the alerts you follow stay in your feed instead of disappearing after a single ping.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The full Notifications page and the header bell now read from one shared source, so the unread count and your read state stay consistent across both.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Critical whale and price alerts can now reach you through email and Telegram when you enable those channels, on top of the in-app feed.',
    },
  ],
};
