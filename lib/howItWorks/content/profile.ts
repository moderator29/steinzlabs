import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const profileHowItWorks: HowItWorksContent = {
  title: 'Profile',
  tagline: 'Your account home for identity, plan, privacy, and notification controls.',
  howItWorks: [
    'Your profile shows your display name, avatar, cover photo, tier badge, and the date you joined, pulling from your saved account details.',
    'Edit Profile lets you upload an avatar and cover image, set your username, name, and a short bio. Images are downscaled in your browser before upload so they stay small and load fast.',
    'Stat tiles surface your rank, points, and the whales and people you follow, with follower and following counts read live from your account rather than this device.',
    'Settings sections cover your plan, notification toggles, privacy visibility, security, language, and a connection to the Telegram alerts bot.',
  ],
  howToUse: [
    'Open the Profile tab from the bottom navigation while signed in.',
    'Tap Edit Profile to change your photos, username, name, and bio, then save.',
    'Use the Settings rows to set notification preferences, privacy visibility, and account security.',
    'Open Privacy to control whether your wallet, activity, and profile are visible to others.',
    'Visit Help Center or AI Customer Service from the Support section when you need a hand.',
  ],
  why: [
    'One place to manage who you are on the platform and what others can see about you.',
    'Privacy and notification choices sync to your account, so they follow you across devices.',
    'A clear view of your current plan and what each upgrade unlocks, with one tap to change it.',
  ],
  whatsNew: [
    { date: 'June 2026', tag: 'NEW', text: 'Your public profile header now displays your tier badge alongside your name.' },
  ],
};
