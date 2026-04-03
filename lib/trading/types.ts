export interface TradeQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromAmountUSD: string;
  toAmountUSD: string;
  priceImpact: number;
  route: RouteInfo[];
  gasEstimate: string;
  chain: string;
  slippage: number;
  validUntil: number;
}

export interface RouteInfo {
  protocol: string;
  fromToken: string;
  toToken: string;
  portion: number;
}

export interface TradeExecution {
  success: boolean;
  txHash?: string;
  error?: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  gasUsed?: string;
  finalPrice?: string;
  timestamp: string;
}

export interface PriceUpdate {
  token: string;
  address: string;
  chain: string;
  price: number;
  priceUSD: number;
  volume24h: number;
  priceChange24h: number;
  liquidity: number;
  timestamp: number;
}
