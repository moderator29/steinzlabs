import { jupiterAPI } from './jupiter';
import { TradeQuote, TradeExecution } from './types';
import { shadowGuardian } from '../security/shadowGuardian';
import { savePosition, getUserByWallet } from '../database/supabase';
import { calculateFee, recordRevenue } from '../revenue/feeSystem';

// 0x Protocol replaces 1inch for all EVM swaps
async function getZeroXQuote(
  chain: string,
  fromToken: string,
  toToken: string,
  amountWei: string,
  slippage: number
): Promise<TradeQuote> {
  const CHAIN_IDS: Record<string, number> = {
    ethereum: 1, base: 8453, arbitrum: 42161, polygon: 137,
    avalanche: 43114, bsc: 56, optimism: 10,
  };
  const chainId = CHAIN_IDS[chain];
  if (!chainId) throw new Error(`Unsupported chain for 0x: ${chain}`);

  const apiKey = process.env.NEXT_PUBLIC_ZX_API_KEY || process.env.ZX_API_KEY || '';
  const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
  const feePct = process.env.NEXT_PUBLIC_STEINZ_FEE_PERCENT || '0.004';

  const params = new URLSearchParams({
    chainId: String(chainId),
    sellToken: fromToken,
    buyToken: toToken,
    sellAmount: amountWei,
  });
  if (feeRecipient) {
    params.set('feeRecipient', feeRecipient);
    params.set('buyTokenPercentageFee', feePct);
  }

  const res = await fetch(`https://api.0x.org/swap/allowance-holder/price?${params}`, {
    headers: { '0x-api-key': apiKey, '0x-version': 'v2' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`0x price failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const toAmountEth = (parseInt(data.buyAmount || '0') / 1e18).toString();

  return {
    fromToken,
    toToken,
    fromAmount: (parseInt(amountWei) / 1e18).toString(),
    toAmount: toAmountEth,
    fromAmountUSD: '0',
    toAmountUSD: '0',
    priceImpact: 0,
    route: [{ protocol: '0x', fromToken, toToken, portion: 100 }],
    gasEstimate: (parseInt(data.gas || '200000') * 20e9 / 1e18).toFixed(6),
    chain,
    slippage,
    validUntil: Date.now() + 30000,
  };
}

export async function getOptimalQuote(params: {
  fromToken: string;
  toToken: string;
  amount: number;
  chain: string;
  slippage?: number;
}): Promise<TradeQuote> {
  const { fromToken, toToken, amount, chain, slippage = 0.5 } = params;

  if (chain === 'solana') {
    return jupiterAPI.getQuote(fromToken, toToken, amount, slippage * 100);
  } else {
    const amountWei = Math.floor(amount * 1e18).toString();
    return getZeroXQuote(chain, fromToken, toToken, amountWei, slippage);
  }
}

export async function executeTrade(params: {
  quote: TradeQuote;
  userWallet: string;
  userAddress: string;
  chain: string;
  signTransaction: any;
  autoExit?: boolean;
  followingEntity?: string;
}): Promise<TradeExecution> {
  const { quote, userWallet, userAddress, chain, signTransaction, autoExit, followingEntity } = params;

  try {

    const scan = await shadowGuardian.scanTrade(
      quote.toToken,
      parseFloat(quote.toAmount),
      userWallet
    );

    if (scan.blocked) {

      return {
        success: false,
        error: `BLOCKED: ${scan.message}`,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        timestamp: new Date().toISOString(),
      };
    }



    let execution: TradeExecution;

    if (chain === 'solana') {
      execution = await jupiterAPI.executeSwap(quote, userAddress, signTransaction);
    } else {
      // 0x swap execution — get firm quote then sign
      try {
        const CHAIN_IDS: Record<string, number> = {
          ethereum: 1, base: 8453, arbitrum: 42161, polygon: 137,
          avalanche: 43114, bsc: 56, optimism: 10,
        };
        const chainId = CHAIN_IDS[chain];
        if (!chainId) throw new Error(`Unsupported chain: ${chain}`);

        const apiKey = process.env.NEXT_PUBLIC_ZX_API_KEY || process.env.ZX_API_KEY || '';
        const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
        const feePct = process.env.NEXT_PUBLIC_STEINZ_FEE_PERCENT || '0.004';
        const amountWei = Math.floor(parseFloat(quote.fromAmount) * 1e18).toString();

        const params = new URLSearchParams({
          chainId: String(chainId),
          sellToken: quote.fromToken,
          buyToken: quote.toToken,
          sellAmount: amountWei,
          taker: userAddress,
        });
        if (feeRecipient) {
          params.set('feeRecipient', feeRecipient);
          params.set('buyTokenPercentageFee', feePct);
        }

        const quoteRes = await fetch(`https://api.0x.org/swap/allowance-holder/quote?${params}`, {
          headers: { '0x-api-key': apiKey, '0x-version': 'v2' },
        });
        if (!quoteRes.ok) throw new Error(`0x quote failed: ${quoteRes.status}`);
        const quoteData = await quoteRes.json();

        const txData = quoteData.transaction;
        const txHash = await signTransaction(txData);

        execution = {
          success: true,
          txHash,
          fromToken: quote.fromToken,
          toToken: quote.toToken,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          gasUsed: txData?.gas?.toString() || '0',
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const e = error as { message?: string };
        execution = {
          success: false,
          error: e.message || '0x swap execution failed',
          fromToken: quote.fromToken,
          toToken: quote.toToken,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          timestamp: new Date().toISOString(),
        };
      }
    }

    if (execution.success && userWallet) {
      const user = await getUserByWallet(userWallet);
      if (user) {
        const tradeType = followingEntity ? 'COPY_TRADE' as const : 'SWAP' as const;
        const fee = calculateFee(parseFloat(quote.fromAmount), tradeType, chain);

        await savePosition({
          userId: user.id,
          tokenAddress: quote.toToken,
          tokenSymbol: 'UNKNOWN',
          chain,
          entryPrice: parseFloat(quote.fromAmount) / parseFloat(quote.toAmount),
          amount: parseFloat(quote.toAmount),
          valueUsd: parseFloat(quote.toAmountUSD || '0'),
          autoExitEnabled: autoExit,
          followingEntity,
        });

        await recordRevenue({
          userId: user.id,
          tradeType,
          tokenAddress: quote.toToken,
          tokenSymbol: 'UNKNOWN',
          chain,
          tradeAmount: quote.fromAmount,
          feeAmount: fee.feeAmount,
          feeBps: fee.feeBps,
          txHash: execution.txHash || '',
        });


      }
    }

    return execution;
  } catch (error: any) {

    return {
      success: false,
      error: error.message || 'Trade execution failed',
      fromToken: quote.fromToken,
      toToken: quote.toToken,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      timestamp: new Date().toISOString(),
    };
  }
}
