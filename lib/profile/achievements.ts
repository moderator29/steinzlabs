/**
 * Static achievements catalog + unlock evaluator. Each achievement is
 * pure data — title, description, icon name, tier — and a check
 * function that takes the user's aggregate stats and returns a boolean.
 *
 * Storage of unlocked achievements is the caller's job; this module
 * just answers 'given these stats, what should be unlocked'. Pure,
 * no IO. Audit §B.17.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'legendary';

export interface UserStats {
  /** Whales the user follows. */
  whalesFollowed: number;
  /** Total alerts the user has configured. */
  alertsCreated: number;
  /** Total trades the user has executed via the platform. */
  tradesCount: number;
  /** Realized PnL in USD over all closed trades. */
  realizedPnlUsd: number;
  /** Current daily check-in streak (lib/onboarding/streak.ts). */
  currentStreak: number;
  /** Tokens currently on the user's watchlist. */
  watchlistSize: number;
  /** Distinct chains the user has interacted with. */
  chainsActive: number;
  /** Days since signup. */
  accountAgeDays: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  /** Lucide icon name — the consumer renders the icon by name. */
  icon: string;
  /** Predicate run against UserStats. */
  unlocked: (s: UserStats) => boolean;
}

export const ACHIEVEMENTS: ReadonlyArray<Achievement> = [
  // ─── Onboarding tier ─────────────────────────────────────────────
  {
    id: 'first-whale',
    title: 'First whale',
    description: 'Follow your first whale.',
    tier: 'bronze',
    icon: 'Compass',
    unlocked: (s) => s.whalesFollowed >= 1,
  },
  {
    id: 'first-alert',
    title: 'Eyes on',
    description: 'Set your first price alert.',
    tier: 'bronze',
    icon: 'Bell',
    unlocked: (s) => s.alertsCreated >= 1,
  },
  {
    id: 'first-trade',
    title: 'First trade',
    description: 'Execute your first trade via Naka.',
    tier: 'bronze',
    icon: 'Zap',
    unlocked: (s) => s.tradesCount >= 1,
  },
  // ─── Engagement tier ────────────────────────────────────────────
  {
    id: 'streak-7',
    title: 'Week of fire',
    description: 'Check in 7 days in a row.',
    tier: 'silver',
    icon: 'Flame',
    unlocked: (s) => s.currentStreak >= 7,
  },
  {
    id: 'streak-30',
    title: 'Monthly hunter',
    description: 'Check in 30 days in a row.',
    tier: 'gold',
    icon: 'Flame',
    unlocked: (s) => s.currentStreak >= 30,
  },
  {
    id: 'watchlist-20',
    title: 'Watchman',
    description: 'Track 20 tokens on your watchlist.',
    tier: 'silver',
    icon: 'Eye',
    unlocked: (s) => s.watchlistSize >= 20,
  },
  {
    id: 'multichain-3',
    title: 'Cross-chain native',
    description: 'Trade on 3+ distinct chains.',
    tier: 'silver',
    icon: 'Network',
    unlocked: (s) => s.chainsActive >= 3,
  },
  // ─── Performance tier ──────────────────────────────────────────
  {
    id: 'trades-25',
    title: 'Two dozen',
    description: '25 trades through the platform.',
    tier: 'silver',
    icon: 'Zap',
    unlocked: (s) => s.tradesCount >= 25,
  },
  {
    id: 'trades-100',
    title: 'Centurion',
    description: '100 trades through the platform.',
    tier: 'gold',
    icon: 'Zap',
    unlocked: (s) => s.tradesCount >= 100,
  },
  {
    id: 'green-1k',
    title: 'In the green',
    description: 'Realized PnL crosses +$1,000.',
    tier: 'silver',
    icon: 'TrendingUp',
    unlocked: (s) => s.realizedPnlUsd >= 1_000,
  },
  {
    id: 'green-10k',
    title: 'Ten K club',
    description: 'Realized PnL crosses +$10,000.',
    tier: 'gold',
    icon: 'TrendingUp',
    unlocked: (s) => s.realizedPnlUsd >= 10_000,
  },
  {
    id: 'green-100k',
    title: 'Six-figure trader',
    description: 'Realized PnL crosses +$100,000.',
    tier: 'legendary',
    icon: 'TrendingUp',
    unlocked: (s) => s.realizedPnlUsd >= 100_000,
  },
  {
    id: 'og',
    title: 'Naka OG',
    description: 'Account 180+ days old.',
    tier: 'gold',
    icon: 'Shield',
    unlocked: (s) => s.accountAgeDays >= 180,
  },
];

/**
 * Evaluate every achievement against the user's stats and return the
 * IDs that are currently unlocked. Use this to compare against the
 * stored 'awarded' set and detect newly-earned achievements (which
 * should fire a toast + persist to user_achievements).
 */
export function evaluateAchievements(stats: UserStats): string[] {
  return ACHIEVEMENTS.filter((a) => a.unlocked(stats)).map((a) => a.id);
}
