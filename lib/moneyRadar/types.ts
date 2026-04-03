export interface FollowedEntity {
  userId: string;
  entityId: string;
  entityName: string;
  entityType: string;
  wallets: string[];
  active: boolean;
  createdAt: Date;
}

export interface EntityTrade {
  entityId: string;
  entityName: string;
  walletAddress: string;
  token: string;
  tokenAddress: string;
  chain: string;
  action: 'BUY' | 'SELL';
  amount: string;
  amountUSD: string;
  price: string;
  timestamp: Date;
  txHash: string;
}

export interface CopyTradeParams {
  userId: string;
  entityTrade: EntityTrade;
  copyAmount: number;
  autoExit: boolean;
}
