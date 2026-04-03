export interface ArkhamEntity {
  id: string;
  name: string;
  type: string;
  verified: boolean;
  description?: string;
  addresses?: string[];
  logo?: string;
  website?: string;
  twitter?: string;
  crunchbase?: string;
  linkedin?: string;
}

export interface ArkhamAddress {
  address: string;
  chain: string;
  arkhamEntity: ArkhamEntity | null;
  labels: string[];
  firstSeen: string;
  lastSeen: string;
  transactionCount: number;
  totalVolume?: string;
  scamHistory?: ScamHistory;
}

export interface ScamHistory {
  totalRugs: number;
  totalStolen: string;
  victims: number;
  scams: ScamDetails[];
  lastScam: string;
  status: 'active' | 'inactive';
}

export interface ScamDetails {
  token: string;
  date: string;
  amount: string;
  victims: number;
  type: 'rug_pull' | 'honeypot' | 'liquidity_theft';
}

export interface ArkhamHolder {
  address: string;
  balance: string;
  balanceUSD: string;
  percentage: number;
  entity?: ArkhamEntity;
  labels?: string[];
  firstAcquired?: string;
  lastActivity?: string;
}

export interface ArkhamConnection {
  address: string;
  entity?: ArkhamEntity;
  relationship: string;
  labels: string[];
  totalValue: string;
  transactionCount: number;
}

export interface EntityPortfolio {
  entityId: string;
  totalValue: string;
  lastUpdated: string;
  holdings: {
    [chain: string]: TokenHolding[];
  };
}

export interface TokenHolding {
  token: string;
  tokenAddress: string;
  amount: string;
  valueUSD: string;
  percentage: number;
  entryPrice?: string;
  currentPnL?: string;
}

export interface EntityPerformance {
  entityId: string;
  winRate: number;
  totalTrades: number;
  avgHoldTime: number;
  avgGainOnWinners: number;
  avgLossOnLosers: number;
  bestTrade: TradeOutcome;
  worstTrade: TradeOutcome;
  recentTrades: TradeOutcome[];
}

export interface TradeOutcome {
  token: string;
  entryDate: string;
  exitDate: string;
  holdTime: number;
  gain: number;
  amountUSD: string;
}

export interface ArkhamTransaction {
  hash: string;
  chain: string;
  timestamp: string;
  blockNumber: number;
  from: {
    address: string;
    entity?: ArkhamEntity;
  };
  to: {
    address: string;
    entity?: ArkhamEntity;
  };
  value: string;
  valueUSD: string;
  token?: {
    symbol: string;
    address: string;
    amount: string;
  };
  gasUsed: string;
  gasFee: string;
  type: 'transfer' | 'swap' | 'stake' | 'contract_interaction';
}
