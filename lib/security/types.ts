export interface ScanResult {
  allowed: boolean;
  blocked: boolean;
  riskScore: number;
  reason?: string;
  scammers?: ScammerInfo[];
  verifiedHolders?: string[];
  suspiciousConnections?: number;
  aiAnalysis?: string;
  recommendation: 'SAFE' | 'CAUTION' | 'BLOCKED';
  message: string;
}

export interface ScammerInfo {
  address: string;
  name: string;
  rugPulls: number;
  totalStolen: string;
  victims: number;
  lastScam: string;
}

export interface WalletReputation {
  score: number;
  reputation: 'VERIFIED' | 'UNKNOWN' | 'SUSPICIOUS' | 'DANGEROUS';
  verified: boolean;
  entity: any | null;
  warnings: string[];
  benefits: string[];
  allowAccess: boolean;
}

export interface PortfolioThreat {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  token: string;
  tokenAddress: string;
  userHolding: string;
  threat: {
    type: 'SCAMMER_IN_HOLDERS' | 'LIQUIDITY_RISK' | 'SMART_MONEY_EXIT';
    details: any;
  };
  recommendation: string;
  createdAt: Date;
}
