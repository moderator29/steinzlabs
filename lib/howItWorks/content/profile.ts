import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const profileHowItWorks: HowItWorksContent = {
  title: 'Profile',
  tagline: 'Your account home for identity, plan, privacy, notifications, and support.',
  howItWorks: [
    'Profile is the hub for who you are on Naka Labs, pulling your display name, username, avatar, cover photo, tier badge, verified mark, email, connected wallet, and member since date straight from your saved account.',
    'The header card reads your live plan from your account tier and shows whether you are on Free, Mini, Pro, or Max, with a plain summary of what your plan includes and a one tap path to upgrade or change it.',
    'Five stat tiles sit below your name: your rank and points, plus Following and Followers, where the Following count comes from the whales you track in your account and the Followers count comes from accepted social follows, both read live from the server rather than from this device so they stay correct across logins.',
    'The notifications panel merges alerts delivered to your account with locally generated events such as whale moves, price targets, trending tokens, security warnings, and wallet activity, refreshing on a short interval and tracking which items you have already read.',
    'Edit Profile lets you set your username, first and last name, and a short bio, and upload an avatar and a wide cover banner that are downscaled and recompressed in your browser before upload so they load fast and stay synced to your account.',
    'Settings group together your notification toggles, Preferences for appearance and platform defaults, Privacy visibility controls, account Security, and a Telegram link card, and changes that belong to your account are saved server side so they follow you everywhere you sign in.',
    'Support gives you an AI customer service chat that answers questions about the platform in plain language along with a Help Center of common questions and a direct route to the team for anything the assistant cannot resolve.',
  ],
  howToUse: [
    'Open the Profile tab from the bottom navigation while signed in to see your header card, stat tiles, plan, and settings.',
    'Tap Edit Profile to upload an avatar and cover image, set your username, name, and bio, then save your changes.',
    'Review the Plan card to see what your current tier includes, and use Upgrade or Change to move between Free, Mini, Pro, and Max.',
    'Expand the notifications panel to read recent alerts, tap an item to mark it read, or use Mark all read to clear the unread badge.',
    'Open Preferences to set your theme, accent, glass intensity, and density, choose your default chain, currency, and language, and tune notification channels and quiet hours.',
    'Open Privacy to control whether your wallet, trading activity, direct messages, and public profile are visible to others, and these toggles sync to your account immediately.',
    'Use Security to change your password and review login activity, link the alerts bot from the Telegram card, or reach the AI customer service and Help Center from the Support section.',
  ],
  why: [
    'Profile keeps everything about your identity, plan, and account controls in one place, so you never have to hunt across the app to update a name, switch a plan, or change who can see your activity.',
    'Because privacy, appearance, and notification choices that belong to your account are stored server side, the experience you set on one device carries over the moment you sign in on another.',
    'Reach for it when you are setting up a new account, deciding whether an upgrade unlocks the features you need, tightening what others can see before going public, or wiring real-time alerts to Telegram.',
    'It fits a trading workflow as the quiet control panel behind the noisy screens, the place you tune defaults, manage your subscription, and resolve account questions so the rest of the platform behaves the way you want.',
  ],
  whatsNew: [
    { date: 'June 2026', tag: 'IMPROVED', text: 'Your tier badge now shows next to your name on both your in-app profile header and your public profile page.' },
    { date: 'June 2026', tag: 'NEW', text: 'Preferences now includes a live appearance panel for theme, accent color, glass intensity, and interface density that retints the app instantly and syncs to your account.' },
    { date: 'June 2026', tag: 'IMPROVED', text: 'Avatar and cover uploads are downscaled and recompressed in your browser before upload, keeping images small and fast while staying synced across your devices.' },
  ],
};
