import { TradeQuote, TradeExecution } from './types';

// 1inch API v6 — EVM chains routing
// Docs: https://portal.1inch.dev/documentation/swap/swagger

const CHAIN_IDS: Record<string, number> = {
  ethereum:  1,
  bsc:       56,
  polygon:   137,
  arbitrum:  42161,
  optimism:  10,
  base:      8453,
  avalanche: 43114,
  gnosis:    100,
};

const BASE_URL = 'https://api.1inch.dev/swap/v6.0';
const API_KEY  = process.env.ONEINCH_API_KEY || '';

function headers() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };
}

class OneInchAPI {
  async getQuote(
    chain: string,
    fromToken: string,
    toToken: string,
    amountWei: string,
    slippage: number
  ): Promise<TradeQuote> {
    const chainId = CHAIN_IDS[chain];
    if (!chainId) throw new Error(`Unsupported chain for 1inch: ${chain}`);

    const params = new URLSearchParams({
      src: fromToken,
      dst: toToken,
      amount: amountWei,
    });

    const res = await fetch(`${BASE_URL}/${chainId}/quote?${params}`, {
      headers: headers(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`1inch quote failed (${res.status}): ${text}`);
    }

    const data = await res.json();

    const route = (data.protocols?.[0]?.[0] || []).map((p: any) => ({
      protocol: p.name || '1inch',
      fromToken: p.fromTokenAddress || fromToken,
      toToken:   p.toTokenAddress   || toToken,
      portion:   p.part             || 100,
    }));

    const toAmountEth = (parseInt(data.toAmount || '0') / 1e18).toString();

    return {
      fromToken,
      toToken,
      fromAmount: (parseInt(amountWei) / 1e18).toString(),
      toAmount:   toAmountEth,
      fromAmountUSD: data.fromTokenUsdPrice
        ? (parseFloat(data.fromTokenUsdPrice) * parseInt(amountWei) / 1e18).toFixed(2)
        : '0',
      toAmountUSD: data.toTokenUsdPrice
        ? (parseFloat(data.toTokenUsdPrice) * parseInt(data.toAmount || '0') / 1e18).toFixed(2)
        : '0',
      priceImpact:  parseFloat(data.priceImpact || '0'),
      route:        route.length ? route : [{ protocol: '1inch', fromToken, toToken, portion: 100 }],
      gasEstimate:  (parseInt(data.gas || '200000') * 20e9 / 1e18).toFixed(6),
      chain,
      slippage,
      validUntil:   Date.now() + 30000,
    };
  }

  async executeSwap(
    chain: string,
    quote: TradeQuote,
    userAddress: string,
    signTransaction: (txData: any) => Promise<string>
  ): Promise<TradeExecution> {
    const chainId = CHAIN_IDS[chain];
    if (!chainId) {
      return {
        success: false,
        error: `Unsupported chain for 1inch: ${chain}`,
        fromToken: quote.fromToken,
        toToken:   quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount:   quote.toAmount,
        timestamp:  new Date().toISOString(),
      };
    }

    try {
      const amountWei = Math.floor(parseFloat(quote.fromAmount) * 1e18).toString();

      const params = new URLSearchParams({
        src:      quote.fromToken,
        dst:      quote.toToken,
        amount:   amountWei,
        from:     userAddress,
        slippage: quote.slippage.toString(),
      });

      const res = await fetch(`${BASE_URL}/${chainId}/swap?${params}`, {
        headers: headers(),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`1inch swap build failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      const txData = data.tx;

      // signTransaction is called by the wallet adapter on the client side;
      // server builds the tx data and returns the hash after submission.
      const txHash = await signTransaction(txData);

      return {
        success: true,
        txHash,
        fromToken:  quote.fromToken,
        toToken:    quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount:   quote.toAmount,
        gasUsed:    txData?.gas?.toString() || '0',
        timestamp:  new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error:      error.message || '1inch swap execution failed',
        fromToken:  quote.fromToken,
        toToken:    quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount:   quote.toAmount,
        timestamp:  new Date().toISOString(),
      };
    }
  }
}

export const oneInchAPI = new OneInchAPI();
