import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { TradeQuote, TradeExecution } from './types';

class JupiterAPI {
  private baseUrl = 'https://quote-api.jup.ag/v6';
  private connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  );

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippage: number = 50
  ): Promise<TradeQuote> {
    try {
      const lamports = Math.floor(amount * 1e9);

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: lamports.toString(),
        slippageBps: slippage.toString(),
      });

      const response = await fetch(`${this.baseUrl}/quote?${params}`);

      if (!response.ok) {
        throw new Error(`Jupiter quote failed: ${response.statusText}`);
      }

      const data = await response.json();

      const route = data.routePlan?.map((step: any) => ({
        protocol: step.swapInfo?.label || 'Jupiter',
        fromToken: step.swapInfo?.inputMint || inputMint,
        toToken: step.swapInfo?.outputMint || outputMint,
        portion: 100 / (data.routePlan?.length || 1),
      })) || [];

      return {
        fromToken: inputMint,
        toToken: outputMint,
        fromAmount: amount.toString(),
        toAmount: (parseInt(data.outAmount) / 1e9).toString(),
        fromAmountUSD: '0',
        toAmountUSD: '0',
        priceImpact: parseFloat(data.priceImpactPct || '0'),
        route,
        gasEstimate: '0.00001',
        chain: 'solana',
        slippage: slippage / 100,
        validUntil: Date.now() + 30000,
      };
    } catch (error) {
      console.error('Jupiter quote failed:', error);
      throw error;
    }
  }

  async executeSwap(
    quote: TradeQuote,
    userPublicKey: string,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  ): Promise<TradeExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get swap transaction');
      }

      const { swapTransaction } = await response.json();

      const transactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      const signedTransaction = await signTransaction(transaction);

      const rawTransaction = signedTransaction.serialize();
      const txHash = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      const confirmation = await this.connection.confirmTransaction(txHash, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
      }

      return {
        success: true,
        txHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        gasUsed: '0.00001',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Jupiter swap execution failed:', error);
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

  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/price?ids=${tokenAddress}`);
      const data = await response.json();
      return data.data?.[tokenAddress]?.price || 0;
    } catch (error) {
      console.error('Failed to get token price:', error);
      return 0;
    }
  }
}

export const jupiterAPI = new JupiterAPI();
