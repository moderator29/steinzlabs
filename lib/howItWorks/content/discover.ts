import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const discoverHowItWorks: HowItWorksContent = {
  title: 'Discover',
  tagline: 'Find and follow the traders worth watching across the Naka Labs community.',
  howItWorks: [
    'Discover is the people hub of the platform, pairing a live search box with a personalized recommendation strip and a grid of community leaderboards so you can find accounts worth following in one place.',
    'The search box runs a debounced live autocomplete that matches your text against both usernames and display names, returning the closest profiles with their tier badge, and when you are signed in it shows your real follow state plus a "Follows you" hint on each row rather than a flat label.',
    'The "You might like to follow" strip scores candidates from several honest signals: accounts with the most followers on the platform, people followed by the people you already follow, members on a tier above yours, traders with a strong success rate, and accounts that joined recently, then it surfaces the top suggestions with a short reason on each card.',
    'The leaderboard grid ranks the community across eight boards: Top Success Rate, Top Followers, New Users, Max Tier, Top Traders, Most Active, Top Copy Traders, and Top Whale Watchers.',
    'Each board reads live data rather than a cached snapshot, with Top Traders showing thirty-day portfolio performance, Top Copy Traders showing copy-trade win rate, Top Whale Watchers counting the whales each member actively follows from on-chain follow edges, and reputation-backed boards drawing from the platform success and activity scores.',
    'Boards auto-refresh every few minutes so ranking movement appears without a manual reload, success-rate figures respect each member\'s own privacy setting, and accounts you have blocked or muted are filtered out of your results.',
  ],
  howToUse: [
    'Open Discover from the navigation to land on the hub, where the search box sits above the recommendations strip and the leaderboard grid.',
    'Start typing a username or display name to see live autocomplete results, then pick a profile to open it, or press Enter to open the full search-results view for that query.',
    'Scan the "You might like to follow" strip, read the reason on each card to see why it was suggested, tap Follow on the accounts that fit your strategy, and dismiss the cards you are not interested in so they stop reappearing on future visits.',
    'Work through the eight leaderboards to see who leads on the metric you care about, whether that is raw success rate, follower reach, thirty-day trading performance, copy-trade win rate, or whale-watching activity.',
    'On the Top Whale Watchers board, open the drill-down on a member to see exactly which whales they are following before you decide to mirror their watchlist.',
    'Use "View all" on any board to open its full standalone ranking when the top entries are not enough, and open a profile from any row to follow, message, or study that trader in depth.',
  ],
  why: [
    'Following the right people turns raw market noise into signal you can act on, and Discover is the fastest way to assemble a feed of traders whose moves actually matter to you.',
    'Transparent rankings built from real follow edges, on-chain whale follows, and performance scores let you judge accounts by behavior instead of hype, with privacy settings honored throughout.',
    'Reach for it when you are building a watchlist, vetting a trader before you copy or mirror them, or looking for fresh accounts that are gaining traction in the community.',
    'It fits naturally at the top of a research workflow: discover and follow here, then study individual profiles, whale activity, and portfolios elsewhere on the platform.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Search results now show your real follow state and a "Follows you" hint instead of a flat label, and rows surface each account\'s tier badge.',
    },
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'The Top Whale Watchers board now reports the true count of whales a member follows with a drill-down to that watchlist, replacing a misleading percentage.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The recommendation strip now biases toward established accounts by weighting platform follower reach alongside collaborative signals, so suggestions favor proven traders over brand-new signups.',
    },
  ],
};
