import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const messagesHowItWorks: HowItWorksContent = {
  title: 'Messages',
  tagline: 'A private, end-to-end encrypted inbox for direct messages with anyone on the platform.',
  howItWorks: [
    'Each conversation is end-to-end encrypted: a per-conversation key is sealed for both people, so the server only ever stores ciphertext and message text is unsealed inside the thread on your device.',
    'Your inbox splits into two tabs. Primary holds accepted conversations, while Requests holds first messages from people who do not yet follow you back, waiting for you to accept or decline.',
    'The search bar finds any platform user by username or display name, letting you open a thread with someone new in one tap.',
    'Unread counts are tracked per conversation and roll up into a badge, and new messages arrive in real time without reloading the page.',
  ],
  howToUse: [
    'Open Messages from the dashboard to see your inbox.',
    'Use the search bar at the top to find someone by username or name, then tap their result to start a conversation.',
    'Switch between the Primary and Requests tabs to read accepted threads or review pending message requests.',
    'Tap any conversation to open the thread, read unsealed messages, and reply.',
    'Open the settings menu to mark everything read, filter to unread only, or toggle notification sound and read receipts.',
  ],
  why: [
    'Your conversations stay private by design, since the platform stores only encrypted message bodies and cannot read them.',
    'The Requests tab keeps unwanted first messages out of your main inbox, so you decide who reaches you.',
    'Real-time delivery and clear unread badges mean you never miss a reply or have to refresh to see it.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'A failed message send now shows an error instead of silently disappearing, and declined requests no longer resurface their history.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'New messages now appear instantly over the live connection rather than only showing up after a page reload.',
    },
  ],
};
