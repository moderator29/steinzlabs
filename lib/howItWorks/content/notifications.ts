import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const notificationsHowItWorks: HowItWorksContent = {
  title: 'Notifications',
  tagline: 'One place for every alert that matters, from whale moves to price breaks to security flags.',
  howItWorks: [
    'Your notification feed pulls together live market signals and your own account events into a single, time-ordered list.',
    'Market alerts cover price breaks, trending tokens, large whale activity, and potential security risk events, all derived from real on-chain and market data.',
    'Account and alert events you have set up, like a triggered whale follow, are stored durably so they stay in your feed even after you reload.',
    'Each entry shows a clear title, a short message, and how long ago it happened, with unread items marked so you can scan what is new at a glance.',
  ],
  howToUse: [
    'Open Notifications from the side navigation or the header bell to see your full feed.',
    'Scan the list from newest to oldest; unread items carry a blue dot so they stand out.',
    'Tap any notification with a linked destination to jump straight to the related token, wallet, or page.',
    'Use Mark all read to clear the unread count once you are caught up.',
  ],
  why: [
    'It keeps every important market and account signal in one feed, so you never miss a move while it is still actionable.',
    'Durable alerts mean the events you care about stay available, not just flashed once and lost.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Triggered whale alerts now write a durable in-app notification, so the alerts you follow stay in your feed instead of disappearing after a single ping.',
    },
  ],
};
