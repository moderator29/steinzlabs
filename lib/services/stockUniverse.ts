import 'server-only';

/**
 * Curated stock universe for the Stocks tab. Every symbol is a real Yahoo
 * Finance ticker. `marquee: true` names show by default (Apple-Stocks style);
 * the rest appear when the user taps "Show all". Grouped into the three board
 * tabs: stocks (indices + blue chips), rwa (commodities / metals / tokenized
 * real-world assets via ETFs), and ai (AI / semiconductor / compute names).
 */

export type StockTab = 'stocks' | 'rwa' | 'ai';

export interface StockDef {
  symbol: string; // Yahoo ticker
  name: string;
  marquee?: boolean;
}

const STOCKS: StockDef[] = [
  { symbol: '^DJI', name: 'Dow Jones Industrial Average', marquee: true },
  { symbol: '^GSPC', name: 'S&P 500', marquee: true },
  { symbol: '^IXIC', name: 'Nasdaq Composite', marquee: true },
  { symbol: 'AAPL', name: 'Apple Inc.', marquee: true },
  { symbol: 'MSFT', name: 'Microsoft Corp.', marquee: true },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', marquee: true },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', marquee: true },
  { symbol: 'META', name: 'Meta Platforms, Inc.', marquee: true },
  { symbol: 'TSLA', name: 'Tesla, Inc.', marquee: true },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', marquee: true },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', marquee: true },
  { symbol: 'V', name: 'Visa Inc.', marquee: true },
  { symbol: 'DIS', name: 'The Walt Disney Company', marquee: true },
  { symbol: 'BA', name: 'The Boeing Company', marquee: true },
  { symbol: 'NKE', name: 'Nike, Inc.', marquee: true },
  { symbol: 'KO', name: 'The Coca-Cola Company', marquee: true },
  { symbol: 'MCD', name: "McDonald's Corporation", marquee: true },
  { symbol: 'HD', name: 'The Home Depot, Inc.', marquee: true },
  { symbol: 'GE', name: 'GE Aerospace', marquee: true },
  { symbol: 'WMT', name: 'Walmart Inc.', marquee: true },
  // Show-all tail
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.' },
  { symbol: 'SBUX', name: 'Starbucks Corporation' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'BAC', name: 'Bank of America Corporation' },
  { symbol: 'MA', name: 'Mastercard Incorporated' },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.' },
  { symbol: 'ABNB', name: 'Airbnb, Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies, Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
  { symbol: 'RL', name: 'Ralph Lauren Corporation' },
  { symbol: 'VFC', name: 'V.F. Corporation' },
  { symbol: 'AZN', name: 'AstraZeneca PLC' },
];

const RWA: StockDef[] = [
  { symbol: 'GC=F', name: 'Gold Futures', marquee: true },
  { symbol: 'SI=F', name: 'Silver Futures', marquee: true },
  { symbol: 'CL=F', name: 'Crude Oil WTI', marquee: true },
  { symbol: 'GLD', name: 'SPDR Gold Shares', marquee: true },
  { symbol: 'SLV', name: 'iShares Silver Trust', marquee: true },
  { symbol: 'USO', name: 'United States Oil Fund', marquee: true },
  { symbol: 'PLTR', name: 'Palantir Technologies', marquee: true },
  { symbol: 'HG=F', name: 'Copper Futures' },
  { symbol: 'NG=F', name: 'Natural Gas Futures' },
  { symbol: 'PA=F', name: 'Palladium Futures' },
  { symbol: 'PL=F', name: 'Platinum Futures' },
  { symbol: 'VNQ', name: 'Vanguard Real Estate ETF' },
  { symbol: 'DBA', name: 'Invesco Agriculture Fund' },
  { symbol: 'TLT', name: 'iShares 20+ Yr Treasury' },
];

const AI: StockDef[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', marquee: true },
  { symbol: 'AMD', name: 'Advanced Micro Devices', marquee: true },
  { symbol: 'AVGO', name: 'Broadcom Inc.', marquee: true },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', marquee: true },
  { symbol: 'MSFT', name: 'Microsoft Corp.', marquee: true },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', marquee: true },
  { symbol: 'META', name: 'Meta Platforms, Inc.', marquee: true },
  { symbol: 'PLTR', name: 'Palantir Technologies', marquee: true },
  { symbol: 'SMCI', name: 'Super Micro Computer', marquee: true },
  { symbol: 'ARM', name: 'Arm Holdings plc', marquee: true },
  { symbol: 'MU', name: 'Micron Technology' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'ASML', name: 'ASML Holding N.V.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'CRM', name: 'Salesforce, Inc.' },
  { symbol: 'NOW', name: 'ServiceNow, Inc.' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'DELL', name: 'Dell Technologies' },
  { symbol: 'ANET', name: 'Arista Networks' },
  { symbol: 'MRVL', name: 'Marvell Technology' },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings' },
  { symbol: 'PANW', name: 'Palo Alto Networks' },
  { symbol: 'APP', name: 'AppLovin Corporation' },
];

const BY_TAB: Record<StockTab, StockDef[]> = { stocks: STOCKS, rwa: RWA, ai: AI };

export function getUniverse(tab: StockTab, all: boolean): StockDef[] {
  const list = BY_TAB[tab] ?? STOCKS;
  return all ? list : list.filter((d) => d.marquee);
}

/** The ticker-strip names (top marquee) — a compact set of headline movers. */
export function getTickerStripSymbols(): StockDef[] {
  return STOCKS.filter((d) => d.marquee).slice(0, 12);
}

export function nameMapFor(defs: StockDef[]): Record<string, string> {
  return Object.fromEntries(defs.map((d) => [d.symbol, d.name]));
}
