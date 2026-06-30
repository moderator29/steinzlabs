import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const discoverHowItWorks: HowItWorksContent = {
  title: 'Discover',
  tagline: 'Find and follow the traders worth watching across the Naka Labs community.',
  howItWorks: [
    'A live search box finds users by username, display name, or verified badge, with results appearing as you type.',
    'A personalized "You might like to follow" strip suggests people based on who your follows trust, higher tiers, strong success rates, and recent activity.',
    'Eight leaderboards rank the community by success rate, followers, new users, max tier, top traders, copy traders, whale watchers, and most active.',
    'Each leaderboard reads live data and auto-refreshes every few minutes, so movement shows up without a manual reload.',
  ],
  howToUse: [
    'Open Discover from the navigation to land on the people hub.',
    'Type a name or username in the search box, then pick a result to open that profile.',
    'Browse the recommendations strip and tap Follow on anyone who looks interesting, or dismiss the cards you are not into.',
    'Scan the leaderboards to see who is leading on each metric, and tap "View all" to open the full ranking.',
    'On the Top Whale Watchers board, use the drill-down to see exactly which whales a user is following.',
  ],
  why: [
    'Following the right people turns raw market noise into signal you can actually act on.',
    'Transparent, on-chain rankings let you judge traders by real performance instead of hype.',
    'Recommendations and search make it fast to build a feed of people whose moves matter to you.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Search now shows real follow state and a "Follows you" hint on the discover list instead of a flat "Follow" label, and profile rows surface tier badges.',
    },
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'The Top Whale Watchers board now reports the true count of whales a user follows with a drill-down, replacing a misleading percentage.',
    },
  ],
};
