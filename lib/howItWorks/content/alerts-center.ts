import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const alertsCenterHowItWorks: HowItWorksContent = {
  title: 'Alerts Center',
  tagline: 'Every alert you have ever set, from every corner of the platform, gathered into one place you can see, pause, and clean up.',
  howItWorks: [
    'Over time you create alerts in many different places (price alerts from the market, wallet-activity alerts from the whale tracker, trend and composite alerts from the trends tools, and the main alert builder) and each of those has historically lived in its own separate store.',
    'The Alerts Center reads all of those stores at once for your account and presents them as a single, unified list, so you finally have one screen that answers "what am I actually being alerted on?"',
    'Each alert shows what it watches, whether it is currently active or paused, and when it last fired, and the summary at the top tells you how many alerts you have in total, how many are active, and how many are paused.',
    'You can filter by kind (price, wallet, trend, composite, or the main builder alerts) and for any alert you can pause it, resume it, or delete it outright, with the change saved immediately and scoped strictly to your own account.',
    'By design the Center only ever reads, pauses, or removes existing alerts (it never creates one) so using it can only ever reduce the notifications you receive and can never cause a surprise alert to fire.',
    'Everything shown is your real, live alert data, and creating new alerts is done from the dedicated builders the Center links you to.',
  ],
  howToUse: [
    'Open Alerts Center from the sidebar.',
    'Read the summary to see how many alerts you have and how many are active versus paused.',
    'Use the filter chips to focus on one kind of alert.',
    'Tap the bell on any alert to pause or resume it, or the trash icon to delete it: changes save instantly.',
    'Use the Create new alert link to jump to the builder when you want to add one.',
  ],
  why: [
    'Alerts accumulate silently, and most people end up with forgotten rules firing noise months later, so a single place to audit and prune everything is genuinely valuable for keeping your notifications signal, not spam.',
    'Unifying alerts that were previously scattered across separate systems means you no longer have to remember which page a given alert was created on to manage it.',
    'Because the Center is deliberately read, pause, and delete only, it is completely safe to use for cleanup: there is no way to accidentally create a new alert from here.',
    'Reach for it whenever your notifications feel noisy, when you want to confirm an important alert is still active, or to do a periodic clean-up of rules you no longer need.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Alerts Center launched: one unified place to see, pause, resume, and delete every alert across the price, wallet, trend, composite, and main alert systems: read and manage only, never creating a surprise alert.',
    },
  ],
};
