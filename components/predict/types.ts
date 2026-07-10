// Shape contract for the Naka Predict frontend. Mirrors the backend endpoints
// exactly (see the /api/predict/* contract). Kept local so the components stay
// decoupled from the route modules and the client bundle stays clean.

export type Direction = 'above' | 'below';
export type Side = 'yes' | 'no';
export type MarketKind = 'threshold' | 'direction';

export interface Market {
  id: string;
  symbol: string;
  coingeckoId: string;
  // 'threshold' = will {SYMBOL} be above/below $X? · 'direction' = one-tap UP/DOWN.
  // Older payloads may omit this; treat a missing kind as 'threshold'.
  kind?: MarketKind;
  direction: Direction;
  target: number;
  price: number;
  openPrice: number;
  closesAt: string; // ISO
  horizonSeconds: number;
  probYes: number; // 0..1
  yesMultiplier: number;
  noMultiplier: number;
  volume: number;
  entriesCount: number;
  series: number[];
}

export interface ResolvedMarket {
  id: string;
  symbol: string;
  direction: Direction;
  target: number;
  resolvedPrice: number;
  outcome: Side;
  closesAt: string;
}

export interface MarketsResponse {
  markets: Market[];
  results: ResolvedMarket[];
}

export interface PriceTick {
  symbol: string;
  price: number;
  series: number[];
}

export interface PriceResponse {
  prices: PriceTick[];
}

export interface Entry {
  id: string;
  marketId: string;
  symbol: string;
  side: Side;
  stake: number;
  multiplier: number;
  status: string; // 'open' | 'won' | 'lost' | 'void' | ...
  payout: number;
  market: {
    question: string;
    closesAt: string;
    outcome: Side | null;
  };
}

export interface MeStats {
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  marketsPlayed: number;
  totalWon: number;
}

export interface MeResponse {
  points: number;
  stats: MeStats;
  open: Entry[];
  history: Entry[];
}

export interface Leader {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  wins: number;
  bestStreak: number;
}

export interface LeaderboardResponse {
  leaders: Leader[];
}

export interface EnterResponse {
  ok: boolean;
  pointsLeft?: number;
  entry?: { side: Side; stake: number; multiplier: number };
  error?: string;
}

// ── Daily bonus ──────────────────────────────────────────────────────────────
export interface DailyStatus {
  canClaim: boolean;
  nextAt: string | null; // ISO when the next claim unlocks
  dailyStreak: number;
  points: number;
}

export interface DailyClaimResult {
  ok: boolean;
  awarded?: number;
  dailyStreak?: number;
  points?: number;
  error?: string;
  nextAt?: string | null;
}
