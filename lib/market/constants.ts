import { Timeframe } from './types';

export const TIMEFRAMES: Timeframe[] = ['1H', '6H', '1D', '1W', '1M', '1Y', 'ALL'];

export const CATEGORIES = [
  { id: 'all',      label: 'All'       },
  { id: 'majors',   label: 'Majors'    },
  { id: 'defi',     label: 'DeFi'      },
  { id: 'layer1',   label: 'Layer 1'   },
  { id: 'layer2',   label: 'Layer 2'   },
  { id: 'gaming',   label: 'Gaming'    },
  { id: 'ai',       label: 'AI'        },
  { id: 'meme',     label: 'Meme'      },
  { id: 'depin',    label: 'DePIN'     },
  { id: 'pumpfun',  label: 'Pump.fun'  },
  { id: 'bnb-meme', label: 'BNB Meme'  },
] as const;

export const MAJOR_IDS = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'cardano', 'avalanche-2', 'polkadot', 'chainlink', 'uniswap',
];

export const CG_CATEGORY_MAP: Record<string, string> = {
  defi: 'decentralized-finance-defi',
  depin: 'depin',
  cults: 'meme-token',
};

export const CHAIN_IDS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' },
  { id: 'bsc', label: 'BNB Chain' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'optimism', label: 'Optimism' },
] as const;

export const PLATFORM_FEE_BPS = 20; // 0.2% for market trades

export const SWAP_RISK_THRESHOLD = 70;

export const POLLING_INTERVALS = {
  LIVE_PRICE: 5_000,
  RECENT_TRADES: 5_000,
  ORDER_BOOK: 30_000,
  WATCHLIST_PRICES: 60_000,
  PRICE_ALERTS: 60_000,
} as const;
