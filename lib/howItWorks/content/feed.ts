import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const feedHowItWorks: HowItWorksContent = {
  title: 'Feed',
  tagline: 'A social feed built into the dashboard where you post, follow, and reward good calls with real crypto.',
  howItWorks: [
    'Feed is the social layer of the platform. Each post is a short piece of text with one optional image under one megabyte and up to three topic tags, so a call stays quick to read and easy to sort.',
    'There are two views you can switch between. Signal surfaces the posts gaining the most traction right now, and Pack shows only the people you follow, so you can move between discovery and your own circle without leaving the page.',
    'A single-select topic filter runs along the top, drawn from a fixed catalogue of subjects. Choosing one narrows the feed to that topic, and clearing it returns you to the full stream.',
    'Every post carries four actions: Like to show support, Comment to reply in a thread, Repost to share it with your own followers, and Gift to send the author real crypto straight from your wallet.',
    'A floating plus button sits at the bottom right of the feed. It opens the composer over whatever you are reading, so you can post a thought the moment you have it and return to the same scroll position.',
    'Likes, comments, reposts, and follows update live, so counts and new posts appear without a manual refresh.',
  ],
  howToUse: [
    'Open the dashboard and select the Feed tab to load the stream.',
    'Switch between Signal for trending posts and Pack for the people you follow, and tap a catalogue topic to filter the stream to a single subject.',
    'Tap the floating plus button at the bottom right to open the composer.',
    'Write your text, attach one image under one megabyte if you want, and add up to three topic tags so the right people find it, then post.',
    'On any post use Like, Comment, or Repost to engage, and open a thread to reply to the author or other readers.',
    'Tap Gift on a post to send the author crypto directly from your own wallet, choose the chain and amount, and confirm the transfer.',
    'Follow the accounts whose calls you value so their posts show up in your Pack view.',
  ],
  why: [
    'Keeping the feed to one image and three tags per post keeps the signal high, so you spend time reading calls rather than wading through noise.',
    'Signal and Pack let you flip between finding new voices and checking in on the people you already trust, which suits both discovery and daily reading.',
    'Because Gift moves real crypto from your wallet to the author, appreciation carries actual weight and the people making good calls can be rewarded on the spot.',
    'Reach for Feed when you want to share a thought, track what the community is watching, or find someone worth following before you act on a token elsewhere in the app.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Feed launches on the dashboard with a Signal trending view and a Pack view for the people you follow, single-select topic filters, and a floating compose button.',
    },
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Every post now supports Like, Comment, Repost, and Gift, so you can reward a good call by sending the author real crypto from your own wallet.',
    },
  ],
};
