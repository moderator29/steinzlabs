/**
 * Full WalletProfile type definitions
 * Used across: wallet-tracer, cluster analysis, portfolio dashboard, sniper engine
 */

// ─── Chain types ──────────────────────────────────────────────────────────────

export type WalletChain =
  | 'ethereum'
  | 'solana'
  | 'base'
  | 'arbitrum'
  | 'optimism'
  | 'bsc'
  | 'polygon';

// ─── On-chain position ────────────────────────────────────────────────────────

export interface WalletTokenPosition {
  tokenAddress: string;
  symbol: string;
  name: string;
  logo?: string;
  balance: number;         // raw token units (not adjusted for decimals)
  balanceFormatted: number; // adjusted for decimals
  priceUsd: number;
  valueUsd: number;
  chain: WalletChain;
  decimals: number;
  isNative: boolean;
  pnlUsd?: number;          // unrealised P&L if entry price known
  pnlPercent?: number;
  avgEntryUsd?: number;
}

// ─── Transaction summary ──────────────────────────────────────────────────────

export interface WalletTransaction {
  hash: string;
  chain: WalletChain;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'swap' | 'stake' | 'unstake' | 'nft' | 'other';
  tokenAddress?: string;
  tokenSymbol?: string;
  amount?: number;
  valueUsd?: number;
  from: string;
  to?: string;
  timestamp: number;
  blockNumber?: number;
  fee?: number;
  feeUsd?: number;
  success: boolean;
}

// ─── Performance metrics ──────────────────────────────────────────────────────

export interface WalletPerformance {
  winRate: number;          // 0–100
  avgWinUsd: number;
  avgLossUsd: number;
  profitFactor: number;     // total gains / total losses
  totalRealizedPnlUsd: number;
  totalUnrealizedPnlUsd: number;
  bestTradeUsd: number;
  worstTradeUsd: number;
  avgHoldTimeHours: number;
  tradeCount30d: number;
  volumeUsd30d: number;
  roiPercent30d: number;
  roiPercent90d?: number;
  roiPercentAllTime?: number;
}

// ─── Intelligence signals ─────────────────────────────────────────────────────

export type WalletClassification =
  | 'whale'        // > $1M holdings
  | 'smart_money'  // consistently profitable
  | 'sniper'       // new token launches
  | 'dex_trader'   // high-frequency DEX activity
  | 'hodler'       // low turnover, long holds
  | 'bot'          // algorithmic/automated
  | 'market_maker' // both sides of market
  | 'unknown';

export interface WalletSignal {
  type: 'whale_move' | 'coordinated_buy' | 'exit_signal' | 'new_position' | 'cluster_member';
  confidence: number;       // 0–100
  description: string;
  relatedAddresses?: string[];
  relatedTokens?: string[];
  detectedAt: string;
}

// ─── Cluster relationship ─────────────────────────────────────────────────────

export interface ClusterMember {
  address: string;
  chain: WalletChain;
  label?: string;
  coordinationScore: number;  // 0–100
  signals: string[];          // coordination signal descriptions
  firstSeenTogether: string;  // ISO timestamp
}

export interface WalletCluster {
  clusterId: string;
  memberCount: number;
  members: ClusterMember[];
  coordinationScore: number;   // 0–100 — how coordinated this cluster is
  totalValueUsd: number;
  dominantChain: WalletChain;
  primaryTokens: string[];     // most commonly traded together
  detectedAt: string;
  isActive: boolean;
}

// ─── Full WalletProfile ───────────────────────────────────────────────────────

export interface WalletProfile {
  // Identity
  address: string;
  chain: WalletChain;
  label?: string;
  isContract: boolean;
  contractType?: 'erc20' | 'erc721' | 'multisig' | 'dex' | 'bridge' | 'other';
  firstActivity?: string;      // ISO timestamp of first tx
  lastActivity?: string;       // ISO timestamp of most recent tx

  // Holdings
  nativeBalanceUsd: number;
  totalValueUsd: number;
  positions: WalletTokenPosition[];
  topHoldings: WalletTokenPosition[];  // top 5 by value

  // Activity
  txCount30d: number;
  txCountTotal?: number;
  volumeUsd30d: number;
  averageTxUsd: number;
  activeDays30d: number;       // distinct days with activity in last 30

  // Performance intelligence
  performance: WalletPerformance;
  aiScore: number;             // 0–100 VTX intelligence score
  classification: WalletClassification;
  classifications: WalletClassification[];  // can have multiple

  // Signals
  signals: WalletSignal[];

  // Cluster
  clusterInfo?: WalletCluster;
  isClusterMember: boolean;
  clusterConfidence?: number;

  // Risk / identity
  riskScore: number;           // 0–100, higher = higher risk
  isSanctioned: boolean;
  isLabelled: boolean;
  knownEntity?: string;        // e.g. "Binance Hot Wallet 7"
  entityCategory?: 'exchange' | 'protocol' | 'fund' | 'whale' | 'team' | 'hacker' | 'other';

  // Chains (multi-chain profile)
  chains: WalletChain[];
  crossChainValueUsd?: number;

  // Meta
  profileUpdatedAt: string;
  dataQuality: 'full' | 'partial' | 'minimal';
}
