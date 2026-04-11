import { TradeQuote, TradeExecution } from './types';

class OneInchAPI {
  private apiKey = process.env.ONEINCH_API_KEY || '';
  private baseUrl = 'https://api.1inch.dev/swap/v6.0';

  private chains: Record<string, number> = {
    ethereum: 1,
    bsc: 56,
    polygon: 137,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    avalanche: 43114,
  };

  async getQuote(
    chain: string,
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ): Promise<TradeQuote> {
    try {
      const chainId = this.chains[chain];
      if (!chainId) throw new Error(`Unsupported chain: ${chain}`);

      const params = new URLSearchParams({
        src: fromToken,
        dst: toToken,
        amount: amount,
        includeTokensInfo: 'true',
        includeProtocols: 'true',
      });

      const response = await fetch(
        `${this.baseUrl}/${chainId}/quote?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`1inch quote failed: ${response.statusText}`);
      }

      const data = await response.json();

      const route = data.protocols?.flat().map((protocol: any) => ({
        protocol: protocol[0]?.name || '1inch',
        fromToken: protocol[0]?.fromTokenAddress || fromToken,
        toToken: protocol[0]?.toTokenAddress || toToken,
        portion: protocol[0]?.part || 100,
      })) || [];

      return {
        fromToken,
        toToken,
        fromAmount: (parseFloat(amount) / 1e18).toString(),
        toAmount: (parseFloat(data.dstAmount) / 1e18).toString(),
        fromAmountUSD: '0',
        toAmountUSD: '0',
        priceImpact: 0,
        route,
        gasEstimate: data.estimatedGas || '0',
        chain,
        slippage,
        validUntil: Date.now() + 30000,
      };
    } catch (error) {

      throw error;
    }
  }

  async executeSwap(
    chain: string,
    quote: TradeQuote,
    userAddress: string,
    signAndSendTransaction: (txData: any) => Promise<string>
  ): Promise<TradeExecution> {
    try {
      const chainId = this.chains[chain];
      if (!chainId) throw new Error(`Unsupported chain: ${chain}`);

      const fromAmountWei = Math.floor(parseFloat(quote.fromAmount) * 1e18).toString();

      const params = new URLSearchParams({
        src: quote.fromToken,
        dst: quote.toToken,
        amount: fromAmountWei,
        from: userAddress,
        slippage: (quote.slippage * 100).toString(),
        disableEstimate: 'true',
      });

      const response = await fetch(
        `${this.baseUrl}/${chainId}/swap?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get swap transaction');
      }

      const { tx } = await response.json();

      const txHash = await signAndSendTransaction(tx);

      return {
        success: true,
        txHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        gasUsed: tx.gas || '0',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {

      return {
        success: false,
        error: error.message || 'Swap execution failed',
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const oneInchAPI = new OneInchAPI();
