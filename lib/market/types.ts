// ─── CoinGecko ────────────────────────────────────────────────────────────────

export interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  sparkline_in_7d?: { price: number[] };
}

export interface CoinGeckoDetail {
  id: string;
  symbol: string;
  name: string;
  image: { thumb: string; small: string; large: string };
  market_cap_rank: number;
  description: { en: string };
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    fully_diluted_valuation: { usd: number | null };
    total_volume: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    ath: { usd: number };
    ath_change_percentage: { usd: number };
    ath_date: { usd: string };
    sparkline_7d?: { price: number[] };
  };
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeBar {
  time: number;
  value: number;
  color: string;
}

export type Timeframe = '1H' | '6H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

// ─── Watchlist & Alerts ───────────────────────────────────────────────────────

export interface WatchlistItem {
  token_id: string;
  added_at: string;
}

export interface PriceAlert {
  id: string;
  user_id: string;
  token_id: string;
  token_symbol: string;
  target_price: number;
  direction: 'above' | 'below';
  notify_email: boolean;
  is_triggered: boolean;
  triggered_at?: string;
  created_at: string;
}

export interface PriceAlertInput {
  token_id: string;
  token_symbol: string;
  target_price: number;
  direction: 'above' | 'below';
  notify_email: boolean;
}

// ─── Swap ─────────────────────────────────────────────────────────────────────

export interface SwapQuote {
  amountOut: string;
  priceImpact: number;
  route: string;
  feeUSD: number;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  amountOut?: string;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
}

// ─── Dexscreener ─────────────────────────────────────────────────────────────

export interface RecentTrade {
  timestamp: number;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  valueUSD: number;
  wallet: string;
}

export interface OrderBookData {
  buyersPercent: number;
  sellersPercent: number;
  buyCount: number;
  sellCount: number;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioPosition {
  symbol: string;
  name: string;
  logo?: string;
  balance: number;
  currentPriceUSD: number;
  avgEntryUSD: number;
  costBasisUSD: number;
  upnlUSD: number;
  upnlPercent: number;
  tokenAddress?: string;
  chain?: string;
}
